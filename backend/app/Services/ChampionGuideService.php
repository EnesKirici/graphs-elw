<?php

namespace App\Services;

use App\Models\AdminSetting;
use Illuminate\Support\Facades\Cache;

/**
 * ELLE YAZILAN şampiyon rehber metinleri (counter sayfasındaki "Nasıl oynanır"
 * ve eşleşmeye özel "Karşısında nasıl oynanır" kutuları).
 *
 * NEDEN ELLE: bu bilgi maç verisinden ÇIKARILAMAZ. Sayılar "Talon karşısında %27.8
 * kazanıyorsun" der ama "neden" ve "ne yapmalısın" sorusunu yanıtlamaz — o, oyun
 * bilgisi gerektirir. DDragon da yetenek açıklaması verir, eşleşme tavsiyesi vermez.
 *
 * NEREDE DURUYOR: tek bir `champion_guides` admin ayarında, şampiyon id'siyle
 * anahtarlanmış. Ayrı tablo AÇILMADI çünkü veri küçük (şampiyon başına birkaç yüz
 * bayt), tamamı her okumada gerekmiyor ve AdminSetting zaten panelden düzenlenebilir
 * bir JSON deposu. Şampiyon sayısı 170 civarında sabit; büyüme riski yok.
 *
 * Biçim:
 *   {
 *     "Shyvana": {
 *       "play": "Genel oynanış metni…",
 *       "vs": { "Talon": "Talon karşısında…", "Nasus": "…" }
 *     }
 *   }
 */
class ChampionGuideService
{
    public const SETTING_KEY = 'champion_guides';
    private const CACHE_KEY = 'champion:guides';

    /** Tüm rehber deposu (admin paneli düzenlerken bunu okur). */
    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, 3600, function () {
            $v = AdminSetting::getValue(self::SETTING_KEY, []);

            return is_array($v) ? $v : [];
        });
    }

    /**
     * Tek şampiyonun rehberi — counter sayfası yanıtına gömülür.
     * `vs` yalnız METNİ OLAN rakipleri içerir; boş anahtarlar ayıklanır ki
     * frontend "metin var mı" diye ayrıca kontrol etmek zorunda kalmasın.
     *
     * @return array{play: ?string, vs: array<string, string>}
     */
    public function forChampion(string $championId): array
    {
        $g = $this->all()[$championId] ?? [];

        $play = trim((string) ($g['play'] ?? ''));
        $vs = [];
        foreach ((array) ($g['vs'] ?? []) as $opp => $text) {
            $t = trim((string) $text);
            if ($t !== '') {
                $vs[$opp] = $t;
            }
        }

        return ['play' => $play !== '' ? $play : null, 'vs' => $vs];
    }

    /** Ayar panelden değişince çağrılır — bayat rehber gösterilmesin. */
    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
