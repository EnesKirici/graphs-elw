<?php

namespace App\Services\Seo;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Google Search Console — arama performansı verisi.
 *
 * Kimlik doğrulama SERVICE ACCOUNT ile: tarayıcı oturumu, kullanıcı onayı ve
 * yenileme jetonu gerektirmez — sunucudan doğrudan sorgulanır. Google'ın resmi
 * SDK'sı (google/apiclient) yalnız bunun için ~40 MB bağımlılık getiriyordu;
 * ihtiyacımız olan tek şey RS256 imzalı bir JWT, o da PHP'nin openssl'inde var.
 *
 * Akış: service account JSON → imzalı JWT → OAuth2 erişim jetonu → API sorgusu.
 *
 * siteUrl DİKKAT: elwgraphs.com GSC'ye ALAN ADI mülkü olarak eklendi, bu yüzden
 * "https://elwgraphs.com/" değil "sc-domain:elwgraphs.com" biçimi gerekir —
 * yanlış biçim 403 döner ve sebebi hata mesajından anlaşılmaz.
 */
class SearchConsoleService
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
    private const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

    /** Jeton 1 saat geçerli; 5 dk pay bırakıp önbellekte tutuyoruz. */
    private const TOKEN_CACHE_KEY = 'gsc:access_token';
    private const TOKEN_TTL = 3300;

    public function __construct(
        private ?string $credentialsPath = null,
        private ?string $siteUrl = null,
    ) {
        $this->credentialsPath ??= config('services.gsc.credentials');
        $this->siteUrl ??= config('services.gsc.site_url');
    }

    /** Kimlik dosyası yerinde mi? (komutlar buna bakıp anlaşılır hata verir) */
    public function isConfigured(): bool
    {
        return $this->credentialsPath && is_readable($this->credentialsPath);
    }

    /**
     * Arama performansı sorgusu.
     *
     * @param  array  $dimensions  query | page | country | device | date
     * @return array  ['rows' => [...], 'toplam' => int]
     */
    public function searchAnalytics(
        string $startDate,
        string $endDate,
        array $dimensions = ['query'],
        int $rowLimit = 100,
        array $filters = [],
    ): array {
        $body = [
            'startDate'  => $startDate,
            'endDate'    => $endDate,
            'dimensions' => $dimensions,
            'rowLimit'   => $rowLimit,
        ];

        if ($filters) {
            $body['dimensionFilterGroups'] = [['filters' => $filters]];
        }

        $url = self::API_BASE . '/sites/' . rawurlencode($this->siteUrl) . '/searchAnalytics/query';

        $response = Http::withToken($this->accessToken())
            ->timeout(30)
            ->post($url, $body);

        if ($response->failed()) {
            throw new RuntimeException(
                "Search Console sorgusu başarısız (HTTP {$response->status()}): " . $response->body()
            );
        }

        $rows = $response->json('rows') ?? [];

        return [
            'rows'   => array_map(fn($r) => [
                'anahtar'   => $r['keys'] ?? [],
                'tiklama'   => $r['clicks'] ?? 0,
                'gosterim'  => $r['impressions'] ?? 0,
                'ctr'       => round(($r['ctr'] ?? 0) * 100, 2),
                'sira'      => round($r['position'] ?? 0, 1),
            ], $rows),
            'toplam' => count($rows),
        ];
    }

    /** Mülke erişimimiz var mı — kurulum doğrulaması için. */
    public function listSites(): array
    {
        $response = Http::withToken($this->accessToken())->timeout(20)->get(self::API_BASE . '/sites');

        if ($response->failed()) {
            throw new RuntimeException("Site listesi alınamadı (HTTP {$response->status()}): " . $response->body());
        }

        return $response->json('siteEntry') ?? [];
    }

    /** OAuth2 erişim jetonu (önbellekli). */
    private function accessToken(): string
    {
        return Cache::remember(self::TOKEN_CACHE_KEY, self::TOKEN_TTL, function () {
            $sa = $this->credentials();

            $response = Http::asForm()->timeout(20)->post(self::TOKEN_URL, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $this->signedJwt($sa),
            ]);

            if ($response->failed()) {
                throw new RuntimeException(
                    "Google jeton alınamadı (HTTP {$response->status()}): " . $response->body()
                );
            }

            return $response->json('access_token');
        });
    }

    private function credentials(): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException(
                "Service account dosyası okunamadı: {$this->credentialsPath}. " .
                "GSC_CREDENTIALS .env'de tanımlı mı ve dosya sunucuda mı?"
            );
        }

        $sa = json_decode((string) file_get_contents($this->credentialsPath), true);

        if (! isset($sa['client_email'], $sa['private_key'])) {
            throw new RuntimeException('Service account JSON bozuk: client_email / private_key yok.');
        }

        return $sa;
    }

    /** RS256 imzalı JWT — Google'ın jeton ucu bunu bekler. */
    private function signedJwt(array $sa): string
    {
        $now = time();

        $segments = [
            $this->b64(['alg' => 'RS256', 'typ' => 'JWT']),
            $this->b64([
                'iss'   => $sa['client_email'],
                'scope' => self::SCOPE,
                'aud'   => self::TOKEN_URL,
                'iat'   => $now,
                'exp'   => $now + 3600,
            ]),
        ];

        $input = implode('.', $segments);

        if (! openssl_sign($input, $signature, $sa['private_key'], 'sha256')) {
            throw new RuntimeException('JWT imzalanamadı — private_key geçersiz olabilir.');
        }

        return $input . '.' . $this->b64url($signature);
    }

    private function b64(array $data): string
    {
        return $this->b64url(json_encode($data, JSON_UNESCAPED_SLASHES));
    }

    /** JWT base64url: +/ yerine -_ ve sondaki = yok. */
    private function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
