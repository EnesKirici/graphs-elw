<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

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
    private string $lang = 'tr_TR';

    public function __construct()
    {
        $this->baseUrl = config('riot.ddragon_url');
    }

    /**
     * Güncel patch versiyonunu getir.
     * Örnek: "15.6.1"
     */
    public function getCurrentVersion(): string
    {
        return Cache::remember('ddragon:version', 3600, function () {
            $versions = Http::get("{$this->baseUrl}/api/versions.json")->json();
            return $versions[0]; // İlk eleman = en güncel versiyon
        });
    }

    /**
     * Son N patch bucket'ı ("16.13", "16.12", ...) — versions.json'dan major.minor'a
     * indirgenip benzersizleştirilerek, yeni→eski sırada. Meta + prune penceresi
     * (keptPatches) bundan gelir → Riot yeni patch atınca pencere OTOMATİK kayar.
     */
    public function getRecentPatches(int $count): array
    {
        $versions = Cache::remember('ddragon:versions', 3600, function () {
            return Http::get("{$this->baseUrl}/api/versions.json")->json();
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
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/champion.json")->json();
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
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/champion/{$championName}.json")->json();
            return $data['data'][$championName] ?? null;
        });
    }

    /**
     * Tüm item verilerini getir.
     */
    public function getItems(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:items', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/item.json")->json();
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
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/summoner.json")->json();
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
            return Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/runesReforged.json")->json();
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
                    'icon' => "{$this->baseUrl}/cdn/img/{$tree['icon']}",
                    'isTree' => true,
                ];

                foreach ($tree['slots'] as $slot) {
                    foreach ($slot['runes'] as $rune) {
                        $map[$rune['id']] = [
                            'name' => $rune['name'],
                            'icon' => "{$this->baseUrl}/cdn/img/{$rune['icon']}",
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
                    'image' => "{$this->baseUrl}/cdn/{$version}/img/spell/{$spell['image']['full']}",
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
        return "{$this->baseUrl}/cdn/{$version}/img/champion/{$championName}.png";
    }

    public function itemIconUrl(int $itemId): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->baseUrl}/cdn/{$version}/img/item/{$itemId}.png";
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
            $data = Http::timeout(15)
                ->get('https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json')
                ->json();

            $positions = [];
            foreach ($data as $key => $champion) {
                $positions[$key] = $champion['positions'] ?? [];
            }

            return $positions;
        });
    }
}
