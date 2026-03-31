<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

/**
 * Şampiyon ustalık servisi.
 * Oyuncunun en çok oynadığı şampiyonları ve mastery seviyelerini getirir.
 */
class ChampionMasteryService
{
    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
    ) {}

    /**
     * Oyuncunun en iyi şampiyonlarını getir.
     */
    public function getTopMasteries(string $puuid, int $count = 7): array
    {
        $cacheKey = "mastery:top:{$puuid}:{$count}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid, $count) {
            $masteries = $this->api->platformRequest(
                "/lol/champion-mastery/v4/champion-masteries/by-puuid/{$puuid}/top",
                ['count' => $count]
            );

            // DDragon'dan şampiyon listesini al (key→name eşleştirmesi için)
            $champions = $this->ddragon->getChampions();
            $champMap = [];
            foreach ($champions as $champ) {
                $champMap[$champ['key']] = $champ;
            }

            return array_map(function ($m) use ($champMap) {
                $champData = $champMap[(string) $m['championId']] ?? null;

                return [
                    'championId'     => $m['championId'],
                    'championName'   => $champData['name'] ?? 'Bilinmeyen',
                    'championImage'  => $champData
                        ? $this->ddragon->championIconUrl($champData['id'])
                        : null,
                    'championLevel'  => $m['championLevel'],
                    'championPoints' => $m['championPoints'],
                    'lastPlayTime'   => $m['lastPlayTime'],
                ];
            }, $masteries);
        });
    }

    /**
     * Toplam mastery puanı.
     */
    public function getTotalScore(string $puuid): int
    {
        return Cache::remember("mastery:score:{$puuid}", config('riot.cache_ttl.summoner'), function () use ($puuid) {
            return $this->api->platformRequest(
                "/lol/champion-mastery/v4/scores/by-puuid/{$puuid}"
            );
        });
    }
}
