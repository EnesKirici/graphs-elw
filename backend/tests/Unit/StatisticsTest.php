<?php

namespace Tests\Unit;

use App\Support\Statistics;
use PHPUnit\Framework\TestCase;

/**
 * Statistics — küçük-örneklem dürüstlüğü sağlayan saf matematik.
 * Bu fonksiyonlar tüm tier/WR sıralamasının temeli; yanlış olursa sıralama yanlış olur.
 */
class StatisticsTest extends TestCase
{
    // ---- Wilson alt güven sınırı ----

    public function test_wilson_zero_games_returns_zero(): void
    {
        $this->assertSame(0.0, Statistics::wilsonLowerBound(0, 0, 1.96));
    }

    public function test_wilson_known_value_for_50_of_100(): void
    {
        // p=0.5, z=1.96 → analitik ~0.40383
        $this->assertEqualsWithDelta(0.40383, Statistics::wilsonLowerBound(50, 100, 1.96), 0.0005);
    }

    public function test_wilson_result_is_bounded_0_1(): void
    {
        $this->assertGreaterThanOrEqual(0.0, Statistics::wilsonLowerBound(0, 10, 1.96));
        $this->assertLessThanOrEqual(1.0, Statistics::wilsonLowerBound(10, 10, 1.96));
    }

    public function test_wilson_more_games_same_ratio_raises_bound(): void
    {
        // Aynı %50 oran, artan örneklem → alt sınır 0.5'e doğru YÜKSELİR (daha güvenli).
        $z = 1.96;
        $few  = Statistics::wilsonLowerBound(5, 10, $z);
        $some = Statistics::wilsonLowerBound(50, 100, $z);
        $many = Statistics::wilsonLowerBound(500, 1000, $z);

        $this->assertLessThan($some, $few);
        $this->assertLessThan($many, $some);
        $this->assertLessThan(0.5, $many); // alt sınır gözlenen orana alttan yaklaşır
    }

    public function test_wilson_perfect_record_stays_below_one(): void
    {
        // 10/10 = %100 gözlem, ama az maç → alt sınır 1.0 olmamalı (cezalı).
        $v = Statistics::wilsonLowerBound(10, 10, 1.96);
        $this->assertGreaterThan(0.0, $v);
        $this->assertLessThan(1.0, $v);
    }

    // ---- Shrinkage win rate ----

    public function test_shrink_zero_games_returns_zero(): void
    {
        $this->assertSame(0.0, Statistics::shrunkWinRate(0, 0, 100));
    }

    public function test_shrink_known_value(): void
    {
        // (8 + 100*0.5) / (10 + 100) = 58/110
        $this->assertEqualsWithDelta(58 / 110, Statistics::shrunkWinRate(8, 10, 100, 0.5), 1e-9);
    }

    public function test_shrink_pulls_small_high_sample_toward_prior(): void
    {
        // 10/10 gözlem %100 → 0.5'e doğru sert çekilir.
        $this->assertLessThan(0.6, Statistics::shrunkWinRate(10, 10, 100));
    }

    public function test_shrink_large_sample_approaches_observed(): void
    {
        $small = Statistics::shrunkWinRate(80, 100, 100);       // gözlem 0.80
        $large = Statistics::shrunkWinRate(8000, 10000, 100);   // gözlem 0.80
        $this->assertLessThan($large, $small);                  // büyük örneklem gözleme daha yakın
        $this->assertEqualsWithDelta(0.80, $large, 0.01);
    }

    // ---- clamp01 ----

    public function test_clamp01(): void
    {
        $this->assertSame(0.0, Statistics::clamp01(-1.0));
        $this->assertSame(1.0, Statistics::clamp01(2.0));
        $this->assertSame(0.5, Statistics::clamp01(0.5));
    }
}
