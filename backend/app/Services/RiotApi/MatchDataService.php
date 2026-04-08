<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

/**
 * Riot Match-V5 API'den ham veri çekme + cache katmanı.
 */
class MatchDataService
{
    // Queue ID → okunabilir isim
    public const QUEUE_NAMES = [
        420 => 'Solo/Duo',
        440 => 'Flex',
        450 => 'ARAM',
        400 => 'Normal',
        430 => 'Blind',
        490 => 'Quickplay',
        700 => 'Clash',
        900 => 'URF',
        1700 => 'Arena',
    ];

    // Riot sezonu her yıl ~8 Ocak'ta başlar
    private const SEASON_START_DAY = '01-08';

    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
    ) {}

    /**
     * Mevcut sezonun başlangıç timestamp'ini döner.
     * 8 Ocak'tan önceyse önceki yılın sezonunu kullanır.
     */
    public function seasonStartTimestamp(): int
    {
        $year = (int) date('Y');
        $start = strtotime("{$year}-" . self::SEASON_START_DAY);

        if (time() < $start) {
            $start = strtotime(($year - 1) . '-' . self::SEASON_START_DAY);
        }

        return $start;
    }

    /**
     * Son N maçın ID'lerini getir.
     */
    public function getMatchIds(string $puuid, int $count = 20, int $start = 0): array
    {
        $cacheKey = "match:ids:{$puuid}:{$count}:{$start}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $count, $start) {
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['count' => $count, 'start' => $start]
            );
        });
    }

    /**
     * Sezon ranked match ID'lerini cache'li çek.
     */
    public function getSeasonMatchIds(string $puuid, int $queueId): array
    {
        $cacheKey = "season_match_ids:v2:{$puuid}:{$queueId}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $queueId) {
            $seasonStart = $this->seasonStartTimestamp();
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['startTime' => $seasonStart, 'queue' => $queueId, 'count' => 100]
            );
        });
    }

    /**
     * Tek bir maçın detayını getir.
     * Maçlar değişmez → uzun süre cache'le.
     */
    public function getMatchDetail(string $matchId): array
    {
        return Cache::remember("match:detail:{$matchId}", config('riot.cache_ttl.match_detail'), function () use ($matchId) {
            return $this->api->regionRequest(
                "/lol/match/v5/matches/{$matchId}"
            );
        });
    }

    /**
     * Maç timeline verisi — dakika dakika gold/xp/cs + eventler.
     */
    public function getMatchTimeline(string $matchId): ?array
    {
        return Cache::remember("match:timeline:{$matchId}", config('riot.cache_ttl.match_detail'), function () use ($matchId) {
            try {
                return $this->api->regionRequest(
                    "/lol/match/v5/matches/{$matchId}/timeline"
                );
            } catch (\Exception $e) {
                return null;
            }
        });
    }

    /**
     * Champion ID'den görsel URL'i bul.
     */
    public function getChampImageById(int $championId): ?string
    {
        $champions = $this->ddragon->getChampions();
        foreach ($champions as $champ) {
            if ((int) $champ['key'] === $championId) {
                return $this->ddragon->championIconUrl($champ['id']);
            }
        }
        return null;
    }
}
