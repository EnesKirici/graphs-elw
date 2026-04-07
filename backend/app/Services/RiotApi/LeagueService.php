<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

class LeagueService
{
    public function __construct(
        private RiotApiService $api,
    ) {}

    /**
     * Oyuncunun rank bilgileri — artık PUUID ile çalışıyor.
     */
    public function getRankedInfo(string $puuid): array
    {
        $cacheKey = "league:ranked:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $entries = $this->api->platformRequest(
                "/lol/league/v4/entries/by-puuid/{$puuid}"
            );

            $result = [
                'solo' => null,
                'flex' => null,
            ];

            foreach ($entries as $entry) {
                $wins = $entry['wins'];
                $losses = $entry['losses'];

                // W/L/winRate, getWinrateTimeline() tarafından override edilir (tek kaynak)
                // Burada sadece tier/rank/LP ve League API'ye özgü alanlar tutulur
                $data = [
                    'tier'      => $entry['tier'],
                    'rank'      => $entry['rank'],
                    'lp'        => $entry['leaguePoints'],
                    'wins'      => $wins,
                    'losses'    => $losses,
                    'games'     => $wins + $losses,
                    'winRate'   => ($wins + $losses) > 0
                        ? round($wins / ($wins + $losses) * 100, 1)
                        : 0,
                    'hotStreak' => $entry['hotStreak'],
                    'veteran'   => $entry['veteran'] ?? false,
                    'freshBlood'=> $entry['freshBlood'] ?? false,
                    'inactive'  => $entry['inactive'] ?? false,
                    'miniSeries'=> $entry['miniSeries'] ?? null,
                ];

                if ($entry['queueType'] === 'RANKED_SOLO_5x5') {
                    $result['solo'] = $data;
                } elseif ($entry['queueType'] === 'RANKED_FLEX_SR') {
                    $result['flex'] = $data;
                }
            }

            return $result;
        });
    }
}
