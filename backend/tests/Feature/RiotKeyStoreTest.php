<?php

namespace Tests\Feature;

use App\Services\RiotApi\RiotKeyStore;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Anahtar deposunun sözleşmesi.
 *
 * Buradaki iki kural sessizce bozulabilir ve bozulduğunda site günlerce
 * yanlış davranır:
 *  - DB'de kayıt yoksa .env anahtarı kullanılmalı (geçiş güvenliği),
 *  - bitiş zamanı bilinmiyorken "yenileme gerekli" DENMEMELİ.
 */
class RiotKeyStoreTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_db_kaydi_yokken_env_anahtarina_duser(): void
    {
        config(['riot.api_key' => 'RGAPI-env-anahtari']);

        $this->assertSame('RGAPI-env-anahtari', RiotKeyStore::current());
    }

    public function test_gecerli_anahtar_bicimi_kabul_edilir(): void
    {
        $this->assertTrue(
            RiotKeyStore::looksValid('RGAPI-12345678-1234-1234-1234-123456789abc')
        );
    }

    /**
     * Panele yanlış yapıştırılan değer buradan geçerse doğrulama isteğine
     * kadar gider; biçim kontrolü ilk savunma hattı.
     */
    public function test_bozuk_bicimler_reddedilir(): void
    {
        $bozuk = [
            'RGAPI-kisa',
            'RGAPI-12345678-1234-1234-1234-123456789abcEXTRA',
            'NOTAKEY-12345678-1234-1234-1234-123456789abc',
            '',
        ];

        foreach ($bozuk as $key) {
            $this->assertFalse(RiotKeyStore::looksValid($key), "kabul edilmemeliydi: {$key}");
        }
    }

    public function test_riot_401_verdiyse_yenileme_gerekir(): void
    {
        Cache::put('riot:key_invalid', true, 3600);

        $this->assertTrue(RiotKeyStore::needsRefresh());
    }

    /**
     * .env modunda bitiş zamanı bilinmiyor. Bu durumda "yenileme gerekli"
     * demek, header'da sürekli yanlış uyarı yakmak demektir.
     */
    public function test_bitis_zamani_bilinmiyorsa_yenileme_gerekmez(): void
    {
        $this->assertNull(RiotKeyStore::secondsLeft());
        $this->assertFalse(RiotKeyStore::needsRefresh());
    }
}
