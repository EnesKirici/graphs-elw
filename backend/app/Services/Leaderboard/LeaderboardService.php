<?php

namespace App\Services\Leaderboard;

use App\Services\RiotApi\RiotApiService;
use Cron\CronExpression;
use Illuminate\Support\Facades\Cache;

/**
 * Apex lig sıralaması (Challenger / Grandmaster / Master).
 *
 * RIOT TARAFI CANLIDIR: bu uç 24 saatlik bir anlık görüntü değil, oyuncu maçını
 * bitirdiğinde LP'si değişen canlı ladder'dır. Sıralamayı Riot vermez — apex
 * liglerde herkesin rank'ı "I"dır, sırayı LP'ye göre BİZ kuruyoruz.
 *
 * MALİYET: lig listesinin tamamı TEK istek. Pahalı olan kısım kimlik (isim/ikon/
 * şampiyon) — bkz. PlayerIdentityResolver. Bu yüzden liste DB'den doldurulur,
 * Riot'a yalnızca sıkı bir bütçe kadar gidilir.
 *
 * TAZELİK: cache'i asıl tazeleyen `leaderboard:warm` (schedule, 15 dk). Buradaki
 * TTL, worker KAPALIYKEN ziyaretçinin soğuk yola düşmeden ne kadar dayanacağıdır.
 */
class LeaderboardService
{
    public const TIERS  = ['challenger', 'grandmaster', 'master'];
    public const QUEUES = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'];

    /** Yanıt şekli değişince artır — eski cache uyumsuz kalır. */
    private const VERSION = 'v8';

    /** Listede gösterilen oyuncu sayısı. */
    private const SIZE = 50;

    /** Podyum (frontend'de ilk 3 ayrı kart) — bu satırlar şampiyon verisi ister. */
    private const PODIUM_SIZE = 3;

    public function __construct(
        private RiotApiService $api,
        private PlayerIdentityResolver $identity,
    ) {}

    /** Ziyaretçi yolu — cache doluysa Riot'a hiç gidilmez. */
    public function get(string $tier, string $queue): array
    {
        $data = Cache::remember(
            $this->cacheKey($tier, $queue),
            (int) config('elwgraphs.leaderboard.ttl', 5 * 3600),
            fn () => $this->build($tier, $queue, (int) config('elwgraphs.leaderboard.web_budget', 2)),
        );

        // Geri sayım cache'e GÖMÜLMEZ, her yanıtta taze hesaplanır: aksi hâlde
        // cache TTL'i boyunca yaşarken sayaç çoktan geçmiş bir anı gösterirdi.
        $data['nextUpdateAt'] = $this->nextUpdateAt();

        return $data;
    }

    /** Prewarm yolu — cache'i baştan kurar ve üzerine yazar (leaderboard:warm). */
    public function warm(string $tier, string $queue): array
    {
        $data = $this->build($tier, $queue, (int) config('elwgraphs.leaderboard.warm_budget', 15));
        Cache::put(
            $this->cacheKey($tier, $queue),
            $data,
            (int) config('elwgraphs.leaderboard.ttl', 5 * 3600),
        );

        return $data;
    }

    private function cacheKey(string $tier, string $queue): string
    {
        return 'leaderboard:' . self::VERSION . ":{$tier}:{$queue}";
    }

    /**
     * Bir sonraki prewarm turunun zamanı — sayfadaki geri sayım bunu kullanır.
     * Takvim TEK yerden (config) okunur: schedule ile burası ayrışırsa geri sayım
     * yalan söyler. Worker kapalıyken tur koşmaz, o yüzden bu bir SÖZ değil plan.
     */
    public function nextUpdateAt(): ?string
    {
        try {
            return (new CronExpression(config('elwgraphs.leaderboard.refresh_cron', '0 */4 * * *')))
                ->getNextRunDate(now())
                ->format(\DateTimeInterface::ATOM);
        } catch (\Throwable $e) {
            return null;   // bozuk cron ifadesi geri sayımı düşürsün, sayfayı değil
        }
    }

    /**
     * Listeyi kurar: 1 Riot isteği (lig) + 1 SQL (kimlikler) + en fazla $riotBudget
     * kadar kimlik isteği (her biri 3 Riot çağrısı).
     */
    /** Son build turunun Riot deneme sayaçları — prewarm komutu raporlar. */
    public function lastFetchStats(): array
    {
        return $this->identity->stats();
    }

    private function build(string $tier, string $queue, int $riotBudget): array
    {
        $this->identity->resetStats();

        $league = $this->api->platformRequest("/lol/league/v4/{$tier}leagues/by-queue/{$queue}");
        $all = $league['entries'] ?? [];

        // Apex liglerde sıra Riot'tan gelmez — LP'ye göre biz kuruyoruz.
        $sorted = collect($all)->sortByDesc('leaguePoints')->values()->take(self::SIZE);

        // Listenin TAMAMININ kimliği tek sorguda, Riot'a gitmeden.
        $identities = $this->identity->fromDatabase(
            $sorted->pluck('puuid')->filter()->all()
        );

        $spent = 0;

        $entries = $sorted->map(function (array $entry, int $index) use (&$spent, $riotBudget, $identities, $tier, $queue) {
            $puuid = $entry['puuid'] ?? null;
            $id = $puuid ? ($identities[$puuid] ?? null) : null;

            // Eksik kalan satırları bütçe elverdiğince Riot'tan tamamla. Derinlik
            // sınırı YOK: liste sırayla dolduğu için bütçe zaten üst sıraları
            // önceler, ama havuz dolduğunda 50. satır da tamamlanabilsin.
            //
            // İlk 3 = podyum: o kartlar şampiyon portreleriyle tasarlandı, mastery
            // gelmezse kart çöküp tablo satırına benziyor (Grandmaster'da görüldü).
            // Bu yüzden podyumda "ismi var" yetmez, şampiyon da aranır.
            $isPodium = $index < self::PODIUM_SIZE;

            if ($puuid && $spent < $riotBudget && $this->identity->needsRiot($id, $puuid, $isPodium)) {
                $spent++;
                // Elimizdeki kısmi kimlik geçilir: yalnız şampiyonu eksik oyuncu
                // 3 istek değil 1 istek eder.
                $id = $this->identity->fetchFromRiot($puuid, $entry, $tier, $queue, $id) ?? $id;
            }

            $games = ($entry['wins'] ?? 0) + ($entry['losses'] ?? 0);

            return [
                'rank'        => $index + 1,
                'puuid'       => $puuid,
                'name'        => $id['name'] ?? null,
                'profileIcon' => $id['profileIcon'] ?? null,
                'topChamps'   => $id['topChamps'] ?? null,
                'topRoles'    => $id['topRoles'] ?? null,
                'tier'        => strtoupper($tier),
                'lp'          => $entry['leaguePoints'] ?? 0,
                'wins'        => $entry['wins'] ?? 0,
                'losses'      => $entry['losses'] ?? 0,
                'games'       => $games,
                'winRate'     => $games > 0 ? round(($entry['wins'] ?? 0) / $games * 100, 1) : 0,
                'hotStreak'   => $entry['hotStreak'] ?? false,
                'veteran'     => $entry['veteran'] ?? false,
                'freshBlood'  => $entry['freshBlood'] ?? false,
            ];
        });

        return [
            'tier'      => strtoupper($tier),
            'queue'     => $queue,
            'total'     => count($all),
            'updatedAt' => now()->toIso8601String(),
            'entries'   => $entries->all(),
        ];
    }
}
