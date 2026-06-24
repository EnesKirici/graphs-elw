<?php

namespace Tests\Unit;

use App\Services\LpTrackingService;
use PHPUnit\Framework\TestCase;

/**
 * LpTrackingService::lpToAbsolute — tier+rank+LP → tek mutlak sayı (maç-başına LP farkı için).
 * Saf fonksiyon; Master+ tek division kuralı ve division ofsetleri kritik.
 */
class LpToAbsoluteTest extends TestCase
{
    private LpTrackingService $svc;

    protected function setUp(): void
    {
        $this->svc = new LpTrackingService();
    }

    public function test_iron_iv_zero_is_absolute_zero(): void
    {
        $this->assertSame(0, $this->svc->lpToAbsolute('IRON', 'IV', 0));
    }

    public function test_division_and_lp_offsets(): void
    {
        $this->assertSame(350, $this->svc->lpToAbsolute('IRON', 'I', 50));   // 0 + 300 + 50
        $this->assertSame(1200, $this->svc->lpToAbsolute('GOLD', 'IV', 0));  // 1200 + 0 + 0
        $this->assertSame(1475, $this->svc->lpToAbsolute('GOLD', 'II', 75)); // 1200 + 200 + 75
    }

    public function test_master_plus_single_division_ignores_rank(): void
    {
        // Master/GM/Challenger → base 2800 + LP; division (rank) yok sayılır.
        $this->assertSame(2950, $this->svc->lpToAbsolute('MASTER', 'I', 150));
        $this->assertSame(2950, $this->svc->lpToAbsolute('MASTER', 'IV', 150)); // rank farketmez
        $this->assertSame(3300, $this->svc->lpToAbsolute('GRANDMASTER', 'I', 500));
        $this->assertSame(4000, $this->svc->lpToAbsolute('CHALLENGER', 'I', 1200));
    }

    public function test_monotonic_progression_across_tiers(): void
    {
        $iron     = $this->svc->lpToAbsolute('IRON', 'IV', 0);     // 0
        $gold     = $this->svc->lpToAbsolute('GOLD', 'IV', 0);     // 1200
        $diamond1 = $this->svc->lpToAbsolute('DIAMOND', 'I', 100); // 2800
        $master50 = $this->svc->lpToAbsolute('MASTER', 'I', 50);   // 2850

        $this->assertLessThan($gold, $iron);
        $this->assertLessThan($diamond1, $gold);
        $this->assertLessThan($master50, $diamond1); // Master 50LP, Diamond I 100LP'yi geçer
    }

    public function test_tier_is_case_insensitive(): void
    {
        $this->assertSame(1200, $this->svc->lpToAbsolute('gold', 'IV', 0));
    }
}
