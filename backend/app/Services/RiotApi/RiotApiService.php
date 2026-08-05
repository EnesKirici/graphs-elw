<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class RiotApiService
{
    /** İstek sayacı ve rate limit kaydının ömrü — ikisi birlikte yaşamalı. */
    private const STATS_TTL = 600;

    /** Anahtarın Riot tarafından reddedildiğini işaretleyen bayrak. */
    private const KEY_INVALID_KEY = 'riot:key_invalid';

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
        } else {
            // KOTA PAYI FRENİ — worker kotanın tamamını yiyemez.
            // shouldYield() reaktifti (kullanıcı isteği geldikten SONRA çekilir);
            // ziyaretçi tam da kota dolmuşken gelirse yol verecek kota kalmıyordu.
            // Burada worker kendi payını aşamaz, kalan pay ziyaretçiye ayrılmış bekler.
            // 429 fırlatılır çünkü çağıranlar bunu zaten "bekle, sonra dene" olarak
            // ele alıyor (ProcessMatchJob release eder, retryUntil affeder) —
            // maç kaybolmaz, yalnızca ertelenir.
            $worker = app(\App\Services\WorkerControlService::class);
            if (! $worker->reserveQuotaSlot()) {
                self::track('quota_held');
                throw new \Exception(
                    "Worker kota payı doldu (%{$worker->quotaSharePercent()}). Ziyaretçi payı korunuyor.",
                    429,
                );
            }
        }

        $cooldownKey = 'riot:rate_limit_cooldown';
        $cooldownUntil = Cache::get($cooldownKey);
        if ($cooldownUntil && time() < $cooldownUntil) {
            $wait = $cooldownUntil - time();
            self::track('blocked');
            throw new \Exception("Rate limit aktif. {$wait} saniye bekleyin.", 429);
        }

        $response = Http::timeout(10)
            ->withHeaders(['X-Riot-Token' => RiotKeyStore::current()])
            ->get($url, $query);

        self::track('request');
        self::recordRateInfo($response);
        self::recordKeyStatus($response);

        if ($response->status() === 429) {
            $retryAfter = (int) ($response->header('Retry-After') ?: 5);
            Cache::put($cooldownKey, time() + $retryAfter, $retryAfter);
            self::track('rate_limited');
            throw new \Exception("Rate limit aşıldı. {$retryAfter} saniye bekleyin.", 429);
        }

        if ($response->status() === 404) {
            throw new \Exception("Veri bulunamadı.", 404);
        }

        // Dev key'in süresi dolunca Riot 401 "Unknown apikey" döner; 403 değil.
        // İkisi de aynı anlama geliyor, ikisini de burada karşıla.
        if ($response->status() === 401 || $response->status() === 403) {
            throw new \Exception("API key geçersiz veya süresi dolmuş.", $response->status());
        }

        $response->throw();
        return $response->json();
    }

    /**
     * Anahtar geçerliliğini yanıttan öğren — TAHMİN ETME.
     * 401/403 → bayrağı koy, ilk başarılı yanıtta kaldır. Bayrak, key
     * yenilenmezse silinmesin diye sayaçlardan uzun (1 saat) yaşar.
     */
    private static function recordKeyStatus($response): void
    {
        if (! $response) {
            return;
        }

        if (in_array($response->status(), [401, 403], true)) {
            Cache::put(self::KEY_INVALID_KEY, true, 3600);
        } elseif ($response->successful()) {
            Cache::forget(self::KEY_INVALID_KEY);
        }
    }

    /**
     * Riot'un app rate-limit header'larını cache'e yaz (admin bar + bütçe koruması).
     * TTL, istek sayacıyla (track(), 600sn) AYNI: kısa tutulursa sayaç doluyken kayıt
     * uçar ve panel sağlam key'i "geçersiz" sanar. request() + pool yolu ikisi de çağırır.
     */
    private static function recordRateInfo($response): void
    {
        if (! $response) {
            return;
        }
        $appLimit = $response->header('X-App-Rate-Limit');
        $appCount = $response->header('X-App-Rate-Limit-Count');
        if ($appLimit && $appCount) {
            Cache::put('riot:rate_info', [
                'limit' => $appLimit,
                'count' => $appCount,
                'time'  => time(),
            ], self::STATS_TTL);
        }
    }

    /**
     * Dev key'in 2 dk penceresinde ŞU ANA KADAR kullanılmış istek sayısı
     * (admin bar'daki "30/100"in solu). Bilinmiyorsa 0. Arka plan işleri bununla
     * canlıya pay bırakır (BUDGET_RESERVE eşiği).
     */
    public static function appUsed(): int
    {
        $info = Cache::get('riot:rate_info');
        if (! $info || empty($info['count'])) {
            return 0;
        }
        // 2 dk penceresi: kayıt 120sn+ eskiyse o istekler zamanaşımına uğradı → 0
        // (yoksa build, pencere temizlendiği hâlde bayat yüksek sayıya takılıp bekler).
        if (isset($info['time']) && (time() - (int) $info['time']) > 120) {
            return 0;
        }
        // "30:120,3:1" → 30 (ilk pencere = 2 dk)
        return (int) explode(':', explode(',', (string) $info['count'])[0])[0];
    }

    /**
     * Pool response'larından 429 algıla ve cooldown cache'i ayarla.
     * preloadMatchDetails gibi pool kullanan metodlar bu fonksiyonu çağırmalı.
     */
    public static function handlePoolRateLimit($response): bool
    {
        // Pool yolu da anahtarı görüyor — bayrağı burada da güncel tut.
        self::recordKeyStatus($response);
        // Pooled istekler de bütçe sayacını güncellemeli; yoksa build sırasında
        // admin bar / bütçe koruması pooled kullanımı GÖRMEZ ve barı "boş" sanar.
        self::recordRateInfo($response);

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
        Cache::put($key, $current + 1, self::STATS_TTL);
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
            'keyInvalid'   => (bool) Cache::get(self::KEY_INVALID_KEY, false),
            // Anahtarın kalan ömrü — Navbar admin göstergesi son saatte uyarı basar.
            // null: anahtar DB'de değil (.env modu), bitiş zamanı bilinmiyor.
            'keyExpiresIn' => RiotKeyStore::secondsLeft(),
            'keySource'    => RiotKeyStore::meta()['source'] ?? null,
        ];
    }
}
