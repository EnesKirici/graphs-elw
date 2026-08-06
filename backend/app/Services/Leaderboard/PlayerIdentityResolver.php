<?php

namespace App\Services\Leaderboard;

use App\Models\CachedPlayer;
use App\Services\RiotApi\ChampionMasteryService;
use App\Services\RiotApi\DataDragonService;
use App\Services\RiotApi\SummonerService;
use Illuminate\Support\Facades\Cache;

/**
 * puuid → görünen kimlik (isim, profil ikonu, mastery şampiyonları, koridor tahmini).
 *
 * NEDEN AYRI BİR ÇÖZÜMLEYİCİ: Riot'un lig yanıtı (LeagueItemDTO) oyuncu başına
 * SADECE puuid + LP/galibiyet/rozet döner — isim, ikon ve şampiyon YOKTUR
 * (summonerName alanı Riot ID geçişinde kaldırıldı). Bu üç alanı doldurmak
 * oyuncu başına 3 Riot isteği demek: account-v1 + summoner-v4 (ikisi
 * SummonerService::getByPuuid içinde) + champion-mastery-v4. 50 kişilik liste
 * = 1 + 150 istek → dev key'in 2 dakikalık 100'lük penceresini tek sayfa
 * açılışında üçe katlar.
 *
 * Bu yüzden BİRİNCİL KAYNAK VERİTABANI: worker maçları toplarken her katılımcının
 * riotIdGameName/riotIdTagline/profileIcon'unu zaten görüyor (MatchDataService'in
 * sakladığı alanlar) ve cached_players'a düşüyor. Oradan okumak 0 Riot isteği ve
 * tek SQL. Riot'a yalnızca DB'de hiç bulunmayan oyuncular için, çağıranın verdiği
 * bütçe kadar gidilir.
 */
class PlayerIdentityResolver
{
    /** Riot'tan çekilemeyen puuid bu süre boyunca tekrar denenmez (ölü kayda ısrar etme). */
    private const MISS_TTL = 3600;

    /**
     * Son turun Riot denemeleri. Prewarm bunları raporlar: 429 yendiğinde komut
     * eskiden sessizce eksik liste basıyordu ("isimli 32" — neden 32 olduğu
     * görünmüyordu). Sayaç, turun neden tamamlanmadığını görünür kılar.
     */
    private int $attempts = 0;
    private int $failures = 0;
    private ?string $lastError = null;

    public function __construct(
        private SummonerService $summoner,
        private ChampionMasteryService $mastery,
        private DataDragonService $ddragon,
    ) {}

    /**
     * Verilen puuid'lerin DB'deki kimliklerini tek sorguda döner (0 Riot isteği).
     *
     * @param  string[]  $puuids
     * @return array<string, array>  puuid => kimlik
     */
    public function fromDatabase(array $puuids): array
    {
        if (empty($puuids)) {
            return [];
        }

        return CachedPlayer::whereIn('puuid', $puuids)
            ->whereNotNull('game_name')
            ->get(['puuid', 'game_name', 'tag_line', 'top_champions', 'top_roles', 'profile_icon_id'])
            ->mapWithKeys(fn (CachedPlayer $p) => [$p->puuid => [
                'name' => [
                    'gameName' => $p->game_name,
                    'tagLine'  => $p->tag_line,
                ],
                // İkon URL'i DDragon'dan üretilir; sürüm cache'li, istek maliyeti yok.
                'profileIcon' => $p->profile_icon_id
                    ? $this->ddragon->profileIconUrl((int) $p->profile_icon_id)
                    : null,
                'topChamps' => $this->normalizeChampions($p->top_champions),
                'topRoles'  => $this->normalizeRoles($p->top_roles)
                    ?: $this->guessRoles($this->normalizeChampions($p->top_champions)),
            ]])
            ->all();
    }

    /*
     | cached_players'taki top_champions / top_roles TEK BİR ŞEMAYA sahip değil:
     | tabloyu birden çok üretici dolduruyor. Profil tarafı zengin şema yazıyor
     | ({role:'MIDDLE', label:'Mid', icon:'/roles/mid.webp', games:5, winRate:60}),
     | leaderboard ise sade şema ({role:'Mid', count:5}). Frontend sade şemayı
     | bekliyor: ham veriyi geçirmek canlıda kırık rol ikonu ("MIDDLE" ROLE_ICONS'ta
     | yok) ve seviyesiz ustalık rozeti ("M32" yerine "M") üretti.
     |
     | Aşağısı iki şemayı da tek bir çıktıya indirger — okuma tarafında normalize
     | etmek, tabloyu yazan diğer servisleri değiştirmekten güvenli.
     */

    /** @return array<int, array{role:string, count:int}>|null */
    private function normalizeRoles(?array $roles): ?array
    {
        if (empty($roles)) {
            return null;
        }

        $out = [];

        foreach ($roles as $r) {
            if (! is_array($r)) {
                continue;
            }

            // label ('Mid') insan-okunur ve ROLE_ICONS anahtarlarıyla eşleşen ad;
            // role ('MIDDLE') Riot'un ham teamPosition'ı. Önce label denenir.
            $name = $r['label'] ?? $r['role'] ?? null;

            // Riot teamPosition'ı boş bırakabiliyor → 'Invalid' satırı gösterilmez.
            if (! $name || $name === 'Invalid') {
                continue;
            }

            $out[] = [
                'role'  => $name,
                'count' => (int) ($r['count'] ?? $r['games'] ?? 0),
            ];
        }

        // Frontend iki koridor gösteriyor; zengin şema 5 satıra kadar çıkabiliyor.
        return array_slice($out, 0, 2) ?: null;
    }

    /** @return array<int, array{name:string, image:?string, splash:?string, level:?int}>|null */
    private function normalizeChampions(?array $champs): ?array
    {
        if (empty($champs)) {
            return null;
        }

        $out = [];

        foreach ($champs as $c) {
            if (! is_array($c) || empty($c['name'])) {
                continue;
            }

            $out[] = [
                'name'   => $c['name'],
                'image'  => $c['image'] ?? null,
                // Zengin şemada splash/level yok — null geçilir, frontend ikisini de
                // opsiyonel ele alır (splash yoksa portre, level yoksa rozet basılmaz).
                'splash' => $c['splash'] ?? null,
                'level'  => isset($c['level']) ? (int) $c['level'] : null,
            ];
        }

        return $out ?: null;
    }

    /**
     * DB kaydının Riot'a gitmeyi hak edip etmediği.
     * İsim varsa liste zaten gösterilebilir; eksik şampiyon için ısrar edilmez —
     * o oyuncunun maçı toplandığında DB'den bedava gelecek.
     */
    /**
     * @param  bool  $wantChampions  Podyum (ilk 3) için TRUE: o kartlar şampiyon
     *   portreleriyle tasarlandı, mastery'siz kart çöküyor ve tablo satırı gibi
     *   duruyordu. Tablo satırları için FALSE — orada isim yeterli, şampiyon
     *   sütunu boşsa "—" göstermek makul ve istek yakmaya değmez.
     */
    public function needsRiot(?array $identity, string $puuid, bool $wantChampions = false): bool
    {
        $missing = empty($identity['name']['gameName'])
            || ($wantChampions && empty($identity['topChamps']));

        // Erken çıkış SQL tasarrufu: CACHE_STORE=database olduğu için "denendi mi"
        // sorusu bir SELECT'tir; gerçekten Riot'a gidecekken sormak yeterli.
        if (! $missing) {
            return false;
        }

        return ! Cache::get("identity:miss:{$puuid}");
    }

    /**
     * Tek oyuncuyu Riot'tan çeker (3 istek) ve cached_players'a yazar.
     * Başarısız olursa null döner — çağıran DB'deki (varsa) kimlikle devam eder.
     */
    /**
     * @param  array|null  $known  DB'den gelen kısmi kimlik. Elimizde ne varsa
     *   tekrar çekilmez: yalnız şampiyonu eksik bir oyuncu 3 istek değil 1 istek
     *   eder (account + summoner atlanır).
     */
    public function fetchFromRiot(
        string $puuid,
        array $leagueEntry,
        string $tier,
        string $queue,
        ?array $known = null,
    ): ?array {
        $name = $known['name'] ?? null;
        $profileIcon = $known['profileIcon'] ?? null;
        $profileIconId = null;
        $topChamps = $known['topChamps'] ?? null;

        $this->attempts++;

        try {
            if (empty($name['gameName'])) {
                $sum = $this->summoner->getByPuuid($puuid);   // account-v1 + summoner-v4
                $name = [
                    'gameName' => $sum['gameName'] ?? null,
                    'tagLine'  => $sum['tagLine'] ?? null,
                ];
                $profileIcon = $sum['profileIcon'] ?? null;
                $profileIconId = $sum['profileIconId'] ?? null;
            }
        } catch (\Throwable $e) {
            // "Denendi, olmadı" işareti YALNIZCA kalıcı sebep için konur: 404, yani
            // Riot bu puuid'i tanımıyor. 401 (key süresi doldu), 429 (kota) ve 5xx
            // GEÇİCİDİR — bunları işaretlersek geçici bir kesinti yüzünden oyuncu
            // bir saat boyunca isimsiz kalır ve sonraki prewarm turu onu atlar.
            if ((int) $e->getCode() === 404) {
                Cache::put("identity:miss:{$puuid}", true, self::MISS_TTL);
            }

            $this->failures++;
            $this->lastError = '(' . $e->getCode() . ') ' . $e->getMessage();

            return null;
        }

        try {
            if (empty($topChamps)) {
                $masteries = $this->mastery->getTopMasteries($puuid, 5);   // champion-mastery-v4
                $topChamps = array_map(fn ($m) => [
                    'name'   => $m['championName'],
                    'image'  => $m['championImage'],
                    'splash' => $m['championSplash'],
                    'level'  => $m['championLevel'],
                ], $masteries);
            }
        } catch (\Throwable $e) {
            // Mastery isteğe bağlı — isim varsa satır yine tam görünür.
        }

        $topRoles = $this->guessRoles($topChamps) ?? ($known['topRoles'] ?? null);

        try {
            CachedPlayer::updateOrCreate(
                ['puuid' => $puuid],
                array_filter([
                    'game_name'       => $name['gameName'] ?? null,
                    'tag_line'        => $name['tagLine'] ?? null,
                    'tier'            => strtoupper($tier),
                    'rank'            => $leagueEntry['rank'] ?? 'I',
                    'queue'           => $queue,
                    'lp'              => $leagueEntry['leaguePoints'] ?? null,
                    'wins'            => $leagueEntry['wins'] ?? null,
                    'losses'          => $leagueEntry['losses'] ?? null,
                    'top_champions'   => $topChamps,
                    'top_roles'       => $topRoles,
                    'profile_icon_id' => $profileIconId,
                ], fn ($v) => $v !== null),
            );
        } catch (\Throwable $e) {
            // DB yazımı başarısızsa yanıt yine dönsün; sonraki turda tekrar denenir.
        }

        return [
            'name'        => $name,
            'profileIcon' => $profileIcon,
            'topChamps'   => $topChamps,
            'topRoles'    => $topRoles,
        ];
    }

    /** Sayaçları sıfırla — her build turunun başında çağrılır. */
    public function resetStats(): void
    {
        $this->attempts = 0;
        $this->failures = 0;
        $this->lastError = null;
    }

    /** @return array{denendi:int, basarisiz:int, sonHata:?string} */
    public function stats(): array
    {
        return [
            'denendi'   => $this->attempts,
            'basarisiz' => $this->failures,
            'sonHata'   => $this->lastError,
        ];
    }

    /**
     * Mastery şampiyonlarından en olası iki koridor.
     * Gerçek koridor maç geçmişi ister (oyuncu başına ek istek) — bu tahmin bedava.
     */
    public function guessRoles(?array $champs): ?array
    {
        if (empty($champs)) {
            return null;
        }

        $map = config('champion_roles', []);
        $counts = [];

        foreach ($champs as $c) {
            $role = $map[$c['name'] ?? ''] ?? null;
            if ($role) {
                $counts[$role] = ($counts[$role] ?? 0) + 1;
            }
        }

        if (empty($counts)) {
            return null;
        }

        arsort($counts);

        return array_slice(
            array_map(
                fn ($role, $count) => ['role' => $role, 'count' => $count],
                array_keys($counts),
                array_values($counts),
            ),
            0,
            2,
        );
    }
}
