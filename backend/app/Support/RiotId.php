<?php

namespace App\Support;

/**
 * Riot ID temizliği — YAPIŞTIRILAN isimler görünmez karakter taşır.
 *
 * LoL istemcisi (ve çoğu istatistik sitesi) oyuncu adını iki yönlü metin
 * algoritmasından korumak için etrafına Unicode "isolate" işaretleri koyar.
 * Bu işaretler ekranda hiçbir iz bırakmaz ama kopyalanınca metne yapışır:
 *
 *     "Balçovalı<U+2069> #<U+2066>İZMİR"   →   ekranda "Balçovalı #İZMİR"
 *
 * Riot'un Account-V1 ucu bu karakterleri isimde kabul etmez → 404 → sitede
 * "Oyuncu Bulunamadı". 2026-08-05'te canlıda yaşandı: Balçovalı#İZMİR gerçekte
 * VAR (Platin I), kullanıcı adını doğru yapıştırmıştı, hata bizim tarafımızdaydı.
 *
 * Frontend de aynı temizliği yapar; burası SON SAVUNMA — API'yi doğrudan
 * çağıran her istemci (mobil, script, eski önbellekli JS) bundan yararlanır.
 * Ayrıca cache anahtarı temiz isimle kurulduğu için kirli ve temiz sorgu
 * AYNI önbellek girdisini paylaşır (aynı oyuncu iki kez sorulmaz).
 *
 * Silinenler yalnız GÖRÜNMEZ biçim karakterleridir; harflere (İ, ç, ı, ğ)
 * dokunulmaz — Türkçe isimler bozulmadan geçer.
 */
class RiotId
{
    /**
     * Cf (format) sınıfının Riot ID'de asla meşru olmayan üyeleri.
     *   00AD yumuşak tire · 180E moğol ünlü ayracı
     *   200B-200F sıfır-genişlik + LRM/RLM · 202A-202E gömme/geçersiz kılma
     *   2060-2064 görünmez operatörler · 2066-206F isolate + eski biçim (ASIL SUÇLU)
     *   FEFF bayt sırası işareti
     */
    private const INVISIBLE = '/[\x{00AD}\x{180E}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{206F}\x{FEFF}]/u';

    /** Kırılmaz boşluklar — göze normal boşluk gibi görünür, Riot'a farklı gider. */
    private const ODD_SPACE = '/[\x{00A0}\x{2007}\x{202F}\x{3000}]/u';

    /** Tek bir Riot ID parçasını (isim veya tag) güvenli hâle getirir. */
    public static function clean(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        // Geçersiz UTF-8 gelirse preg_replace null döner — girdiyi olduğu gibi
        // bırakmak, sessizce boş isimle Riot'a gitmekten iyidir.
        $cleaned = preg_replace(self::INVISIBLE, '', $value) ?? $value;
        $cleaned = preg_replace(self::ODD_SPACE, ' ', $cleaned) ?? $cleaned;

        return trim($cleaned);
    }
}
