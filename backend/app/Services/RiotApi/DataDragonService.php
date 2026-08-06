<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Data Dragon (DDragon) servisi.
 *
 * DDragon, Riot'un CDN'i. Şampiyon isimleri, görselleri, item bilgileri gibi
 * statik verileri sunar. API key gerektirmez.
 *
 * URL yapısı: https://ddragon.leagueoflegends.com/cdn/{version}/data/{lang}/champion.json
 */
class DataDragonService
{
    private string $baseUrl;
    private string $assetsUrl; // küçük ikonlar (item/champ/spell/passive/rün) — yerel ayna olabilir
    private string $lang = 'tr_TR';

    public function __construct()
    {
        $this->baseUrl = config('riot.ddragon_url');
        $this->assetsUrl = config('riot.ddragon_assets_url');
    }

    /**
     * Güncel patch versiyonunu getir.
     * Örnek: "15.6.1"
     */
    /** Aynı istek içinde sürümü tekrar tekrar cache'ten okumamak için. */
    private ?string $versionMemo = null;

    public function getCurrentVersion(): string
    {
        // CACHE_STORE=database olduğu için her Cache::get bir SELECT'tir; sürüm ise
        // istek boyunca sabittir. Memo olmadan 50 satırlık leaderboard listesi
        // 50 gereksiz sorgu açıyordu (ikon URL'i satır başına sürümü soruyor).
        return $this->versionMemo ??= Cache::remember('ddragon:version', 3600, function () {
            $versions = $this->fetchJson('/api/versions.json', 'versions');
            return $versions[0]; // İlk eleman = en güncel versiyon
        });
    }

    /* ===================== CDN dayanıklılığı =====================
       DDragon CloudFront üzerinde; sunucu→CDN yolu koptuğunda (2026-07-23'te
       sağlayıcı AWS rotası düştü) her istek 10 sn timeout alıp 500 veriyordu.
       Artık: kısa timeout → hata olursa yerel anlık görüntü (storage/app/ddragon)
       → 5 dk devre kesici ile CDN'e boşuna yeniden gidilmez.
       Anlık görüntüler `php artisan ddragon:snapshot` ile üretilir. */

    /** Aynı istek içinde aynı dosyayı ikinci kez parse etmemek için. */
    private array $snapMemo = [];

    private function snapshotPath(string $snap): string
    {
        return storage_path('app/ddragon/' . $snap . '.json');
    }

    private function readSnapshot(string $snap): mixed
    {
        if (array_key_exists($snap, $this->snapMemo)) {
            return $this->snapMemo[$snap];
        }
        $file = $this->snapshotPath($snap);
        $data = is_readable($file) ? json_decode(file_get_contents($file), true) : null;
        return $this->snapMemo[$snap] = $data;
    }

    public function writeSnapshot(string $snap, mixed $data): void
    {
        $file = $this->snapshotPath($snap);
        if (! is_dir(dirname($file))) {
            @mkdir(dirname($file), 0775, true);
        }
        @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
        $this->snapMemo[$snap] = $data;
    }

    /**
     * DDragon'dan JSON çek; erişilemezse yerel anlık görüntüye düş.
     * Her başarılı çekim anlık görüntüyü tazeler (yeni patch kendiliğinden yayılır).
     */
    private function fetchJson(string $path, string $snap): mixed
    {
        // Devre kesici açıksa CDN'i hiç deneme — elde kopya varsa anında dön.
        if (Cache::get('ddragon:cdn_down') && ($local = $this->readSnapshot($snap)) !== null) {
            return $local;
        }

        try {
            $res = Http::timeout(5)->connectTimeout(3)->get($this->baseUrl . $path);
            if ($res->successful() && ($data = $res->json()) !== null) {
                $this->writeSnapshot($snap, $data);
                Cache::forget('ddragon:cdn_down');
                return $data;
            }
            Log::warning('ddragon yanıtı geçersiz', ['path' => $path, 'status' => $res->status()]);
        } catch (\Throwable $e) {
            // Bağlantı kurulamadı → 5 dk boyunca doğrudan anlık görüntüden servis et.
            Cache::put('ddragon:cdn_down', true, 300);
            Log::warning('ddragon erişilemedi, yerel kopyaya düşülüyor', [
                'path' => $path, 'err' => $e->getMessage(),
            ]);
        }

        $local = $this->readSnapshot($snap);
        if ($local !== null) {
            return $local;
        }

        throw new \RuntimeException("DataDragon erişilemedi ve yerel kopya yok: {$path}");
    }

    /**
     * Son N patch bucket'ı ("16.13", "16.12", ...) — versions.json'dan major.minor'a
     * indirgenip benzersizleştirilerek, yeni→eski sırada. Meta + prune penceresi
     * (keptPatches) bundan gelir → Riot yeni patch atınca pencere OTOMATİK kayar.
     */
    public function getRecentPatches(int $count): array
    {
        $versions = Cache::remember('ddragon:versions', 3600, function () {
            return $this->fetchJson('/api/versions.json', 'versions');
        });

        $buckets = [];
        foreach ($versions as $v) {
            $parts = explode('.', $v);
            if (count($parts) < 2 || ! ctype_digit($parts[0])) {
                continue; // "lolpatch_3.9" gibi eski format → atla
            }
            $buckets[$parts[0] . '.' . $parts[1]] = true; // sıra korunur (versions yeni→eski)
            if (count($buckets) >= $count) {
                break;
            }
        }

        return array_keys($buckets);
    }

    /**
     * Tüm şampiyonların listesini getir.
     * 24 saat cache'lenir çünkü sadece yeni patch'te değişir.
     */
    public function getChampions(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:champions', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = $this->fetchJson("/cdn/{$version}/data/{$this->lang}/champion.json", 'champion');
            return $data['data'];
        });
    }

    /**
     * Tek bir şampiyonun detaylı bilgisini getir (skill'ler, lore, istatistikler).
     * Geçersiz/bilinmeyen isimde null döner (eskiden undefined-key ile 500 atıyordu;
     * ör. canlıda /champions/rotation denemesi). Null, remember() tarafından CACHE'LENMEZ.
     */
    public function getChampionDetail(string $championName): ?array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember("ddragon:champion:{$championName}", config('riot.cache_ttl.ddragon'), function () use ($version, $championName) {
            // Tek şampiyon dosyası için ayrı anlık görüntü tutmayız (171 dosya);
            // CDN yoksa championFull anlık görüntüsünden okunur.
            if (! Cache::get('ddragon:cdn_down')) {
                try {
                    $res = Http::timeout(5)->connectTimeout(3)
                        ->get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/champion/{$championName}.json");
                    if ($res->successful()) {
                        return $res->json("data.{$championName}");
                    }
                } catch (\Throwable $e) {
                    Cache::put('ddragon:cdn_down', true, 300);
                    Log::warning('ddragon şampiyon detayı alınamadı', ['champ' => $championName, 'err' => $e->getMessage()]);
                }
            }

            $full = $this->readSnapshot('championFull');
            return $full['data'][$championName] ?? null;
        });
    }

    /**
     * Radar için şampiyon profili: saldırı / savunma / büyü / zorluk (0-10).
     *
     * DDragon'un `info` alanını Riot elle dolduruyor ve BAZI şampiyonlarda hiç
     * doldurmamış — 16.15'te Akshan, Rell, Seraphine ve Vex'te dördü de 0
     * (Akshan 11.16'dan beri böyle, yani eski sürüme düşmek çare değil).
     * O durumda değerler OYUN İSTEMCİSİNDEN türetilir: CommunityDragon, Riot'un
     * istemci veri dosyalarını (rcp-be-lol-game-data) aynen yayınlar; şampiyon
     * seçim ekranındaki hasar/dayanıklılık barları oradaki `playstyleInfo` (0-3).
     * 0-3 → 0-9'a ölçeklenir. Kaba bir çeviri ama bomboş radar göstermekten iyi;
     * kaynak `source` ile döndürülür ki arayüz bunu açıkça yazabilsin.
     *
     * @return array{values: array, source: string}
     */
    public function championProfile(array $champion): array
    {
        $info = $champion['info'] ?? [];
        $sum = (int) ($info['attack'] ?? 0) + (int) ($info['defense'] ?? 0)
             + (int) ($info['magic'] ?? 0) + (int) ($info['difficulty'] ?? 0);

        if ($sum > 0) {
            return ['values' => $info, 'source' => 'ddragon'];
        }

        $derived = $this->clientPlaystyle((int) ($champion['key'] ?? 0));

        return $derived
            ? ['values' => $derived, 'source' => 'client']
            : ['values' => $info, 'source' => 'ddragon'];
    }

    /** CommunityDragon playstyleInfo → DDragon info şeması. Başarısızlıkta null. */
    private function clientPlaystyle(int $key): ?array
    {
        if ($key <= 0) {
            return null;
        }

        // 7 gün: bu değerler yamalar arası neredeyse hiç değişmiyor. Başarısız
        // denemede 1 saatlik "deneme" bayrağı konur ki CDN çökünce her istek
        // 5 saniye beklemesin.
        $cacheKey = "cdragon:playstyle:{$key}";
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached ?: null;
        }

        try {
            $res = Http::timeout(5)->connectTimeout(3)->get(
                "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/{$key}.json"
            );
            if (! $res->successful()) {
                Cache::put($cacheKey, false, 3600);
                return null;
            }

            $play = $res->json('playstyleInfo') ?? [];
            $tac  = $res->json('tacticalInfo') ?? [];
            $dmg  = (int) ($play['damage'] ?? 0) * 3;
            $type = (string) ($tac['damageType'] ?? '');

            $values = [
                // Karma hasarda ikisine de yarım pay: tek eksene yığmak yanıltırdı.
                'attack'     => $type === 'kMagic' ? 0 : ($type === 'kMixed' ? (int) round($dmg / 2) : $dmg),
                'defense'    => (int) ($play['durability'] ?? 0) * 3,
                'magic'      => $type === 'kPhysical' ? 0 : ($type === 'kMixed' ? (int) round($dmg / 2) : $dmg),
                'difficulty' => (int) ($tac['difficulty'] ?? 0) * 3,
            ];

            if (array_sum($values) === 0) {
                Cache::put($cacheKey, false, 3600);
                return null;
            }

            Cache::put($cacheKey, $values, 604800);
            return $values;
        } catch (\Throwable $e) {
            Cache::put($cacheKey, false, 3600);
            Log::warning('communitydragon playstyle alınamadı', ['key' => $key, 'err' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Tüm item verilerini getir.
     */
    public function getItems(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:items', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = $this->fetchJson("/cdn/{$version}/data/{$this->lang}/item.json", 'item');
            return $data['data'];
        });
    }

    /**
     * Summoner spell verilerini getir.
     */
    public function getSummonerSpells(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:spells', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = $this->fetchJson("/cdn/{$version}/data/{$this->lang}/summoner.json", 'summoner');
            return $data['data'];
        });
    }

    /**
     * Rün verileri (runesReforged).
     * Tüm rün ağaçları, keystoneler ve görselleri.
     */
    public function getRunes(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:runes', config('riot.cache_ttl.ddragon'), function () use ($version) {
            return $this->fetchJson("/cdn/{$version}/data/{$this->lang}/runesReforged.json", 'runesReforged');
        });
    }

    /**
     * Rün ID → bilgi map'i oluştur (hızlı lookup için).
     * [perkId => ['name' => '...', 'icon' => '...', 'tree' => '...']]
     */
    public function getRuneMap(): array
    {
        return Cache::remember('ddragon:rune_map', config('riot.cache_ttl.ddragon'), function () {
            $runes = $this->getRunes();
            $map = [];

            foreach ($runes as $tree) {
                // Ağaç bilgisi
                $map[$tree['id']] = [
                    'name' => $tree['name'],
                    'icon' => "{$this->assetsUrl}/cdn/img/{$tree['icon']}",
                    'isTree' => true,
                ];

                foreach ($tree['slots'] as $slot) {
                    foreach ($slot['runes'] as $rune) {
                        $map[$rune['id']] = [
                            'name' => $rune['name'],
                            'icon' => "{$this->assetsUrl}/cdn/img/{$rune['icon']}",
                            'tree' => $tree['name'],
                        ];
                    }
                }
            }

            return $map;
        });
    }

    /**
     * Spell ID → bilgi map'i (summoner1Id/2Id için).
     * [spellKey => ['name' => '...', 'image' => '...']]
     */
    public function getSpellMap(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:spell_map', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $spells = $this->getSummonerSpells();
            $map = [];

            foreach ($spells as $spell) {
                $map[(int) $spell['key']] = [
                    'name' => $spell['name'],
                    'image' => "{$this->assetsUrl}/cdn/{$version}/img/spell/{$spell['image']['full']}",
                ];
            }

            return $map;
        });
    }

    /**
     * Görsel URL'leri oluşturmak için helper method'lar.
     */
    public function championIconUrl(string $championName): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->assetsUrl}/cdn/{$version}/img/champion/{$championName}.png";
    }

    public function itemIconUrl(int $itemId): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->assetsUrl}/cdn/{$version}/img/item/{$itemId}.png";
    }

    public function profileIconUrl(int $iconId): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->baseUrl}/cdn/{$version}/img/profileicon/{$iconId}.png";
    }

    public function splashArtUrl(string $championName, int $skinNum = 0): string
    {
        return "{$this->baseUrl}/cdn/img/champion/splash/{$championName}_{$skinNum}.jpg";
    }

    public function centeredSplashUrl(string $championName, int $skinNum = 0): string
    {
        return "{$this->baseUrl}/cdn/img/champion/centered/{$championName}_{$skinNum}.jpg";
    }

    public function loadingScreenUrl(string $championName, int $skinNum = 0): string
    {
        return "{$this->baseUrl}/cdn/img/champion/loading/{$championName}_{$skinNum}.jpg";
    }

    /**
     * Şampiyon detayından kostüm (skin) listesini standart formata çevirir.
     * Chroma'lar (isminde '(' geçenler) hariç tutulur. Splash URL'leri Data Dragon
     * CDN'inden gelir — sunucuda görsel saklanmaz.
     *
     * @param  array  $detail  getChampionDetail() çıktısı (id, name, skins içerir)
     * @return array<int, array{num:int, name:string, splash:string}>
     */
    public function formatSkins(array $detail): array
    {
        $champId = $detail['id'];
        $champName = $detail['name'] ?? $champId;

        return collect($detail['skins'] ?? [])
            ->reject(fn ($s) => str_contains($s['name'], '('))
            ->values()
            ->map(fn ($s) => [
                'num'    => $s['num'],
                'name'   => $s['name'] === 'default' ? $champName : $s['name'],
                'splash' => $this->splashArtUrl($champId, $s['num']),
            ])
            ->all();
    }

    /**
     * Meraki Analytics'ten şampiyon koridor bilgilerini getir.
     * Her şampiyon için positions dizisi döner: ["TOP", "MIDDLE", "JUNGLE", ...]
     * 24 saat cache'lenir. Tek bir HTTP isteği ile tüm şampiyonlar gelir.
     *
     * @return array<string, string[]> [championKey => ["TOP", "MIDDLE", ...]]
     */
    public function getChampionPositions(): array
    {
        return Cache::remember('meraki:champion_positions', config('riot.cache_ttl.ddragon'), function () {
            $positions = [];
            try {
                $data = Http::timeout(15)
                    ->get('https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json')
                    ->json();
                foreach ($data ?? [] as $key => $champion) {
                    $positions[$key] = $champion['positions'] ?? [];
                }
            } catch (\Exception $e) {
                // Meraki erişilemedi — aşağıdaki DB fallback'i elinden geleni doldurur
            }

            // Meraki yeni şampiyonları GEÇ ekliyor (Locke/Zaahen rolsüz kalıyordu):
            // eksik/boş kalanları KENDİ maç verimizden türet (min 20 maç, rol payı >= %15).
            // Not: DB Riot dilinde (UTILITY), Meraki/frontend SUPPORT bekler → çevrilir.
            try {
                $rows = \App\Models\ChampionStat::where('position', '!=', 'ALL')
                    ->selectRaw('champion_id, position, SUM(games) g')
                    ->groupBy('champion_id', 'position')
                    ->get()
                    ->groupBy('champion_id');

                foreach ($rows as $champId => $set) {
                    if (! empty($positions[$champId])) continue; // Meraki verisi varsa dokunma
                    $total = (int) $set->sum('g');
                    if ($total < 20) continue; // gürültülü örneklemden rol üretme
                    $positions[$champId] = $set
                        ->filter(fn ($r) => $r->g / $total >= 0.15)
                        ->sortByDesc('g')
                        ->pluck('position')
                        ->map(fn ($p) => $p === 'UTILITY' ? 'SUPPORT' : $p)
                        ->values()->all();
                }
            } catch (\Exception $e) {}

            return $positions;
        });
    }
}
