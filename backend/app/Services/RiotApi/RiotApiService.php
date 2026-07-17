<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class RiotApiService
{
    public function platformRequest(string $endpoint, array $query = []): mixed
    {
        return $this->request(config('riot.platform_url') . $endpoint, $query);
    }

    public function regionRequest(string $endpoint, array $query = []): mixed
    {
        return $this->request(config('riot.region_url') . $endpoint, $query);
    }

    /**
     * Temel HTTP isteği — rate limit koruması + sayaç.
     * 429 gelirse sleep YAPMAZ, anında hata fırlatır (PHP timeout'u önler).
     */
    private function request(string $url, array $query = []): mixed
    {
        // Kullanıcı önceliği damgası: web isteği Riot'a gidiyorsa worker
        // (console) bir süre yol verir (WorkerControlService::shouldYield).
        if (! app()->runningInConsole()) {
            Cache::put(\App\Services\WorkerControlService::USER_ACTIVITY_KEY, time(), 60);
        }

        $cooldownKey = 'riot:rate_limit_cooldown';
        $cooldownUntil = Cache::get($cooldownKey);
        if ($cooldownUntil && time() < $cooldownUntil) {
            $wait = $cooldownUntil - time();
            self::track('blocked');
            throw new \Exception("Rate limit aktif. {$wait} saniye bekleyin.", 429);
        }

        $response = Http::timeout(10)
            ->withHeaders(['X-Riot-Token' => config('riot.api_key')])
            ->get($url, $query);

        self::track('request');

        // Riot'un döndürdüğü rate limit header'larını kaydet
        $appLimit = $response->header('X-App-Rate-Limit');
        $appCount = $response->header('X-App-Rate-Limit-Count');
        if ($appLimit && $appCount) {
            Cache::put('riot:rate_info', [
                'limit' => $appLimit,
                'count' => $appCount,
                'time'  => time(),
            ], 300);
        }

        if ($response->status() === 429) {
            $retryAfter = (int) ($response->header('Retry-After') ?: 5);
            Cache::put($cooldownKey, time() + $retryAfter, $retryAfter);
            self::track('rate_limited');
            throw new \Exception("Rate limit aşıldı. {$retryAfter} saniye bekleyin.", 429);
        }

        if ($response->status() === 404) {
            throw new \Exception("Veri bulunamadı.", 404);
        }

        if ($response->status() === 403) {
            throw new \Exception("API key geçersiz veya süresi dolmuş.", 403);
        }

        $response->throw();
        return $response->json();
    }

    /**
     * Pool response'larından 429 algıla ve cooldown cache'i ayarla.
     * preloadMatchDetails gibi pool kullanan metodlar bu fonksiyonu çağırmalı.
     */
    public static function handlePoolRateLimit($response): bool
    {
        if ($response && $response->status() === 429) {
            $retryAfter = (int) ($response->header('Retry-After') ?: 5);
            Cache::put('riot:rate_limit_cooldown', time() + $retryAfter, $retryAfter);
            self::track('rate_limited');
            return true;
        }
        return false;
    }

    /**
     * İstek sayacı — debug için.
     */
    private static function track(string $type): void
    {
        $key = "riot:stats:{$type}";
        $current = Cache::get($key, 0);
        Cache::put($key, $current + 1, 600); // 10dk boyunca tut
    }

    /**
     * Rate limit durumunu döner — debug endpoint için.
     */
    public static function getRateLimitStatus(): array
    {
        $rateInfo = Cache::get('riot:rate_info', []);
        $cooldown = Cache::get('riot:rate_limit_cooldown');

        return [
            'requests'     => Cache::get('riot:stats:request', 0),
            'rateLimited'  => Cache::get('riot:stats:rate_limited', 0),
            'blocked'      => Cache::get('riot:stats:blocked', 0),
            'appLimit'     => $rateInfo['limit'] ?? null,
            'appCount'     => $rateInfo['count'] ?? null,
            'cooldownUntil'=> $cooldown ? max(0, $cooldown - time()) : 0,
            'lastUpdate'   => $rateInfo['time'] ?? null,
        ];
    }
}
