<?php

namespace Tests\Feature;

use App\Services\RiotApi\RiotApiService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Riot anahtar durumu sözleşmesi — topbar göstergesi bunu okur.
 * Kritik kural: "geçersiz" YALNIZ Riot 401/403 dediğinde doğrudur; rate limit
 * kaydının yokluğundan çıkarım yapılamaz (kayıt sayaçtan önce uçarsa sağlam
 * key "GEÇERSİZ" görünüyordu — bu testin varlık sebebi).
 */
class RiotKeyStatusTest extends TestCase
{
    private RiotApiService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        config(['riot.api_key' => 'RGAPI-test']);
        $this->svc = new RiotApiService();
    }

    private function hit(): void
    {
        try {
            $this->svc->platformRequest('/lol/status/v4/platform-data');
        } catch (\Throwable $e) {
            // Hata fırlatması beklenen durumlar var; burada bayrağı ölçüyoruz.
        }
    }

    public function test_dev_key_suresi_dolunca_401_gecersiz_isaretler(): void
    {
        // Riot süresi dolmuş key için 403 değil, 401 "Unknown apikey" döner.
        Http::fake(['*' => Http::response(['status' => ['message' => 'Unknown apikey']], 401)]);

        $this->hit();

        $this->assertTrue(RiotApiService::getRateLimitStatus()['keyInvalid']);
    }

    public function test_403_de_gecersiz_isaretler(): void
    {
        Http::fake(['*' => Http::response([], 403)]);

        $this->hit();

        $this->assertTrue(RiotApiService::getRateLimitStatus()['keyInvalid']);
    }

    public function test_basarili_yanit_bayragi_temizler(): void
    {
        // Sıralı fake: önce reddedilen key, sonra yenilenmiş key.
        Http::fakeSequence()
            ->push(['status' => ['message' => 'Unknown apikey']], 401)
            ->push(['ok' => true], 200);

        $this->hit();
        $this->assertTrue(RiotApiService::getRateLimitStatus()['keyInvalid']);

        $this->hit();
        $this->assertFalse(RiotApiService::getRateLimitStatus()['keyInvalid']);
    }

    public function test_rate_limit_header_gelmemesi_key_gecersiz_demek_degil(): void
    {
        // Header'sız ama başarılı yanıt: istek sayacı dolar, appLimit boş kalır.
        // Eski mantık tam da burada "KEY GEÇERSİZ" diyordu.
        Http::fake(['*' => Http::response(['ok' => true], 200)]);

        $this->hit();

        $status = RiotApiService::getRateLimitStatus();
        $this->assertSame(1, $status['requests']);
        $this->assertNull($status['appLimit']);
        $this->assertFalse($status['keyInvalid']);
    }

    public function test_rate_limit_kaydi_ve_istek_sayaci_ayni_omurde(): void
    {
        // TTL'ler ayrışırsa eski hata geri gelir: sayaç yaşarken kayıt ölür.
        Http::fake(['*' => Http::response(['ok' => true], 200, [
            'X-App-Rate-Limit'       => '100:120,20:1',
            'X-App-Rate-Limit-Count' => '1:120,1:1',
        ])]);

        $this->hit();

        $status = RiotApiService::getRateLimitStatus();
        $this->assertSame('100:120,20:1', $status['appLimit']);
        $this->assertFalse($status['keyInvalid']);

        $ref = new \ReflectionClass(RiotApiService::class);
        $this->assertSame(
            600,
            $ref->getConstant('STATS_TTL'),
            'rate_info ve riot:stats:* aynı TTL sabitini paylaşmalı.'
        );
    }
}
