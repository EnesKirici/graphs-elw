<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class RiotApiService
{
    /**
     * Platform bazlı istek (tr1.api.riotgames.com)
     */
    public function platformRequest(string $endpoint, array $query = []): mixed
    {
        return $this->request(config('riot.platform_url') . $endpoint, $query);
    }

    /**
     * Region bazlı istek (europe.api.riotgames.com)
     */
    public function regionRequest(string $endpoint, array $query = []): mixed
    {
        return $this->request(config('riot.region_url') . $endpoint, $query);
    }

    /**
     * Temel HTTP isteği — retry logic + rate limit koruması.
     *
     * Rate limit aşılırsa:
     * 1. Retry-After header'ını oku
     * 2. O kadar bekle
     * 3. Tekrar dene (max 2 retry)
     */
    private function request(string $url, array $query = [], int $retryCount = 0): mixed
    {
        // Rate limit koruması: son 429 hatasından sonra bekleme süresi
        $cooldownKey = 'riot:rate_limit_cooldown';
        $cooldownUntil = Cache::get($cooldownKey);
        if ($cooldownUntil && time() < $cooldownUntil) {
            $wait = $cooldownUntil - time();
            throw new \Exception("Rate limit aktif. {$wait} saniye bekleyin.", 429);
        }

        $response = Http::timeout(10)
            ->withHeaders([
                'X-Riot-Token' => config('riot.api_key'),
            ])
            ->get($url, $query);

        // 429 = Rate limit aşıldı
        if ($response->status() === 429) {
            $retryAfter = (int) $response->header('Retry-After', 5);

            // Cooldown kaydet — diğer istekler de beklesin
            Cache::put($cooldownKey, time() + $retryAfter, $retryAfter);

            // Max 2 retry
            if ($retryCount < 2) {
                sleep(min($retryAfter, 10)); // Max 10 saniye bekle
                return $this->request($url, $query, $retryCount + 1);
            }

            throw new \Exception("Rate limit aşıldı. {$retryAfter}s bekleyin.", 429);
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
}
