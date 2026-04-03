<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

class SummonerService
{
    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
    ) {}

    /**
     * Riot ID ile oyuncu ara.
     */
    public function searchByRiotId(string $gameName, string $tagLine): array
    {
        $cacheKey = "summoner:riot_id:{$gameName}#{$tagLine}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($gameName, $tagLine) {
            // Account-V1 → PUUID (europe)
            $account = $this->api->regionRequest(
                "/riot/account/v1/accounts/by-riot-id/{$gameName}/{$tagLine}"
            );

            // Summoner-V4 → Profil (tr1)
            $summoner = $this->api->platformRequest(
                "/lol/summoner/v4/summoners/by-puuid/{$account['puuid']}"
            );

            return [
                'puuid'         => $account['puuid'],
                'gameName'      => $account['gameName'],
                'tagLine'       => $account['tagLine'],
                'profileIconId' => $summoner['profileIconId'],
                'profileIcon'   => $this->ddragon->profileIconUrl($summoner['profileIconId']),
                'summonerLevel' => $summoner['summonerLevel'],
                'platform'      => config('riot.platform'),
            ];
        });
    }

    public function getByPuuid(string $puuid): array
    {
        $cacheKey = "summoner:puuid:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $account = $this->api->regionRequest(
                "/riot/account/v1/accounts/by-puuid/{$puuid}"
            );

            $summoner = $this->api->platformRequest(
                "/lol/summoner/v4/summoners/by-puuid/{$puuid}"
            );

            return [
                'puuid'         => $puuid,
                'gameName'      => $account['gameName'],
                'tagLine'       => $account['tagLine'],
                'profileIconId' => $summoner['profileIconId'],
                'profileIcon'   => $this->ddragon->profileIconUrl($summoner['profileIconId']),
                'summonerLevel' => $summoner['summonerLevel'],
                'platform'      => config('riot.platform'),
            ];
        });
    }
}
