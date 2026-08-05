<?php

namespace App\Services\RiotApi;

use App\Models\AdminSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Riot API anahtarının tek kaynağı.
 *
 * NEDEN VAR: anahtar .env'de yaşarken değiştirmek deploy + config temizliği
 * gerektiriyordu ve `config:cache` alınmışsa anahtar donuyordu (DEVAM.md'deki
 * "key tuzağı"). Anahtar artık DB'de: değişince tüm süreçler bir sonraki
 * istekte yeni anahtarı görür, deploy yok, cache tuzağı yok.
 *
 * .env fallback'i BİLEREK duruyor: DB'de kayıt yoksa sistem eskisi gibi
 * RIOT_API_KEY ile çalışır, yani bu sınıf devreye girerken hiçbir şey bozulmaz.
 *
 * Anahtar DB'ye şifreli yazılır (APP_KEY ile). DB yedeği sızarsa anahtar
 * düz metin olarak orada durmasın diye.
 */
class RiotKeyStore
{
    /** AdminSetting anahtarları. */
    private const SETTING = 'riot_api_key';
    private const SETTING_META = 'riot_api_key_meta';

    /** Çözülmüş anahtarın istek-arası cache'i. */
    private const CACHE = 'riot:api_key:resolved';

    /** Dev key'in ömrü — Riot 24 saat veriyor. */
    public const DEV_KEY_TTL_HOURS = 24;

    /**
     * Kullanılacak anahtar: DB → .env.
     *
     * Her Riot isteğinde çağrılır, o yüzden cache'li. TTL kısa tutuldu ki
     * anahtar değişince uzun süre bayat kalmasın; put() zaten cache'i siler,
     * bu yalnızca başka bir süreç (queue worker) yazdığında devreye girer.
     */
    public static function current(): ?string
    {
        $key = Cache::remember(self::CACHE, 60, function () {
            try {
                $stored = AdminSetting::getValue(self::SETTING);
            } catch (\Throwable $e) {
                // DB erişilemiyor (bakım, göç, test ortamı) — Riot trafiği .env
                // anahtarıyla ayakta kalsın, anahtar deposu yüzünden site düşmesin.
                return null;
            }

            if (is_string($stored) && $stored !== '') {
                try {
                    return Crypt::decryptString($stored);
                } catch (\Throwable $e) {
                    // APP_KEY değişmiş ya da kayıt bozuk — .env'e düş, sistemi durdurma.
                    Log::warning('RiotKeyStore: DB anahtarı çözülemedi, .env kullanılıyor.', [
                        'error' => $e->getMessage(),
                    ]);
                    return null;
                }
            }

            return null;
        });

        return $key ?: config('riot.api_key');
    }

    /**
     * Yeni anahtarı kaydet.
     *
     * @param  string  $key       RGAPI- ile başlayan anahtar
     * @param  string  $source    Nereden geldi: 'portal' (otomasyon) | 'manual' (elle)
     * @param  ?int    $expiresAt Portal gerçek bitişi verdiyse unix zaman; yoksa +24s varsayılır
     */
    public static function put(string $key, string $source = 'manual', ?int $expiresAt = null): void
    {
        $key = trim($key);

        AdminSetting::setValue(self::SETTING, Crypt::encryptString($key));
        AdminSetting::setValue(self::SETTING_META, [
            'set_at'     => time(),
            'expires_at' => $expiresAt ?? (time() + self::DEV_KEY_TTL_HOURS * 3600),
            'source'     => $source,
            'tail'       => substr($key, -4),
        ]);

        Cache::forget(self::CACHE);
        // Eski anahtar 401 yediyse konmuş olan "geçersiz" bayrağı artık yanlış.
        Cache::forget('riot:key_invalid');
    }

    /** Kaydın üst verisi: ne zaman konuldu, ne zaman bitiyor, nereden geldi. */
    public static function meta(): array
    {
        try {
            $meta = AdminSetting::getValue(self::SETTING_META, []);
        } catch (\Throwable $e) {
            return [];
        }

        return is_array($meta) ? $meta : [];
    }

    /**
     * Bitişe kalan saniye. Bilinmiyorsa null.
     *
     * Cron bunu okur: Riot süreyi YALNIZCA bitimine 1 saatten az kalınca
     * sıfırlıyor, erken yenileme süreyi ilerletmeden anahtarı boşa harcar.
     */
    public static function secondsLeft(): ?int
    {
        $exp = self::meta()['expires_at'] ?? null;
        return $exp ? max(0, (int) $exp - time()) : null;
    }

    /** Anahtar biteli/bitmesine az mı kaldı? (cron'un yenileme koşulu) */
    public static function needsRefresh(int $thresholdSeconds = 3300): bool
    {
        // Riot 401 verdiyse süreye bakmaya gerek yok, anahtar zaten ölü.
        if (Cache::get('riot:key_invalid')) {
            return true;
        }

        $left = self::secondsLeft();

        // Hiç kayıt yoksa (.env modundayız) otomasyon karar veremez — dokunma.
        return $left !== null && $left <= $thresholdSeconds;
    }

    /**
     * Anahtarı Riot'a sorarak doğrula.
     *
     * Kaydetmeden ÖNCE çağrılır: bozuk bir anahtarı kaydedip siteyi kırmaktansa
     * eski anahtarda kalmak iyidir.
     */
    public static function verify(string $key): bool
    {
        return self::verifyDetailed($key)['ok'];
    }

    /**
     * verify()'ın SEBEBİ de söyleyen hâli.
     *
     * Gerekçe (2026-08-05): panel "Riot bu anahtarı kabul etmedi" diyordu ve
     * neden olduğu anlaşılmıyordu — kota mı, ağ mı, gerçekten ölü anahtar mı?
     * Aynı anahtar dakikalar sonra sunucudan sorunsuz doğrulandı (Riot portalda
     * yeni üretilen anahtar hemen yayılmamış olabilir). Durum kodunu yutmak
     * teşhisi imkânsız kılıyordu.
     *
     * @return array{ok: bool, status: int|null, reason: string}
     *         reason: valid | invalid | quota | network
     */
    public static function verifyDetailed(string $key): array
    {
        try {
            $response = Http::timeout(10)
                ->withHeaders(['X-Riot-Token' => trim($key)])
                ->get(config('riot.platform_url') . '/lol/status/v4/platform-data');

            $status = $response->status();

            if ($response->successful()) {
                return ['ok' => true, 'status' => $status, 'reason' => 'valid'];
            }

            // 429 anahtarın geçersizliğini GÖSTERMEZ — yalnız o an kota dolu.
            // Aynı kefeye koymak, sağlam bir anahtarı reddetmemize yol açardı.
            return [
                'ok'     => false,
                'status' => $status,
                'reason' => $status === 429 ? 'quota' : 'invalid',
            ];
        } catch (\Throwable $e) {
            Log::warning('RiotKeyStore: doğrulama isteği başarısız.', ['error' => $e->getMessage()]);
            return ['ok' => false, 'status' => null, 'reason' => 'network'];
        }
    }

    /** Geçerli bir Riot anahtarı biçimi mi? */
    public static function looksValid(string $key): bool
    {
        return (bool) preg_match('/^RGAPI-[0-9a-fA-F-]{36}$/', trim($key));
    }
}
