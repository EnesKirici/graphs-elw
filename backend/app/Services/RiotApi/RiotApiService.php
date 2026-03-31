<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Client\RequestException;

/**
 * Riot API ile iletişimin merkezi.
 * Tüm Riot API çağrıları bu servis üzerinden yapılır.
 *
 * İki tip istek var:
 * - platformRequest(): tr1.api.riotgames.com (Summoner, League, Mastery, Spectator)
 * - regionRequest(): europe.api.riotgames.com (Account, Match)
 */
class RiotApiService
{
    /**
     * Platform bazlı istek (tr1.api.riotgames.com)
     * Summoner-V4, League-V4, Champion-Mastery-V4, Spectator-V5 gibi endpoint'ler için.
     */
    public function platformRequest(string $endpoint, array $query = []): mixed
    {
        return $this->request(config('riot.platform_url') . $endpoint, $query);
    }

    /**
     * Region bazlı istek (europe.api.riotgames.com)
     * Account-V1, Match-V5 gibi endpoint'ler için.
     */
    public function regionRequest(string $endpoint, array $query = []): mixed
    {
        return $this->request(config('riot.region_url') . $endpoint, $query);
    }

    /**
     * Cache'li istek. Aynı veriyi tekrar tekrar çekmemek için.
     * Riot API'nin rate limit'i var (20 istek/saniye), cache bizi korur.
     */
    public function cachedRequest(string $type, string $cacheKey, string $url, string $endpoint, array $query = []): array
    {
        $ttl = config("riot.cache_ttl.{$type}", 600);

        return Cache::remember($cacheKey, $ttl, function () use ($url, $endpoint, $query) {
            return $this->request($url . $endpoint, $query);
        });
    }

    /**
     * Temel HTTP isteği.
     */
    private function request(string $url, array $query = []): mixed
    {
        $response = Http::timeout(10)
            ->withHeaders([
                'X-Riot-Token' => config('riot.api_key'),
            ])
            ->get($url, $query);

        if ($response->status() === 429) {
            $retryAfter = $response->header('Retry-After', 5);
            throw new \Exception("Riot API rate limit aşıldı. {$retryAfter} saniye bekleyin.", 429);
        }

        if ($response->status() === 404) {
            throw new \Exception("Veri bulunamadı.", 404);
        }

        $response->throw();

        return $response->json();
    }
}
