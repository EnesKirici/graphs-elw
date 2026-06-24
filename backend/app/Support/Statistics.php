<?php

namespace App\Support;

/**
 * Tekrar kullanılabilir istatistik yardımcıları.
 * Tüm WR sıralamaları/tier hesapları küçük örneklemde dürüst olsun diye burada toplanır.
 */
class Statistics
{
    /**
     * Wilson score alt güven sınırı (binom oranı için %95 varsayılan).
     *
     * Gözlenen oran (wins/n) yerine bunun alt sınırı kullanılır → az maçlı yüksek WR
     * 0.5'e doğru çekilir, çok maçlı WR neredeyse aynı kalır. Adil sıralama sağlar.
     *
     * @param int        $wins kazanılan
     * @param int        $n    toplam (oynanan)
     * @param float|null $z    güven z-değeri; null → config('elwgraphs.stats.z')
     * @return float 0–1 arası alt sınır (n=0 → 0)
     */
    public static function wilsonLowerBound(int $wins, int $n, ?float $z = null): float
    {
        if ($n <= 0) {
            return 0.0;
        }

        $z ??= (float) config('elwgraphs.stats.z', 1.96);
        $p  = $wins / $n;
        $z2 = $z * $z;

        $denom  = 1 + $z2 / $n;
        $center = $p + $z2 / (2 * $n);
        $margin = $z * sqrt(($p * (1 - $p) + $z2 / (4 * $n)) / $n);

        return max(0.0, ($center - $margin) / $denom);
    }

    /**
     * 0–1 aralığına kırp.
     */
    public static function clamp01(float $v): float
    {
        return max(0.0, min(1.0, $v));
    }
}
