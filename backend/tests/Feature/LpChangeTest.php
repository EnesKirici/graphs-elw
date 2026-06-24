<?php

namespace Tests\Feature;

use App\Models\LpSnapshot;
use App\Services\LpTrackingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * LpTrackingService::attachLpChanges — bitişik snapshot'lardan maç-başına LP değişimi
 * + tutarlılık kontrolleri (kazanan +, kaybeden −, |Δ|>60 reddi). DB (lp_snapshots) ister.
 */
class LpChangeTest extends TestCase
{
    use RefreshDatabase;

    private LpTrackingService $svc;
    private string $puuid = 'PUUID_TEST';

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new LpTrackingService();
    }

    /** Yardımcı: snapshot oluştur (oluşturma sırası id sırasını → kronolojiyi belirler). */
    private function snap(string $matchId, string $tier, string $rank, int $lp): void
    {
        LpSnapshot::create([
            'puuid' => $this->puuid, 'queue' => 'RANKED_SOLO_5x5',
            'match_id' => $matchId, 'tier' => $tier, 'rank' => $rank, 'lp' => $lp,
        ]);
    }

    /** $matches en yeni → en eski sırada (controller'ın verdiği gibi). */
    private function sampleMatches(): array
    {
        return [
            ['matchId' => 'A', 'queueType' => 'SoloQ', 'win' => true],
            ['matchId' => 'B', 'queueType' => 'SoloQ', 'win' => true],
        ];
    }

    public function test_computes_positive_lp_change_for_win(): void
    {
        $this->snap('B', 'GOLD', 'IV', 50); // önce (eski, düşük id)
        $this->snap('A', 'GOLD', 'IV', 70); // sonra (yeni)

        $out = $this->svc->attachLpChanges($this->puuid, $this->sampleMatches());

        $this->assertSame(20, $out[0]['lpChange']); // A: 1270 - 1250
        $this->assertNull($out[1]['lpChange']);      // B: öncesi yok → null
    }

    public function test_rejects_win_with_negative_diff(): void
    {
        // LP düşmüş ama maç "kazanılmış" → tutarsız, reddedilir (null).
        $this->snap('B', 'GOLD', 'IV', 70);
        $this->snap('A', 'GOLD', 'IV', 50);

        $out = $this->svc->attachLpChanges($this->puuid, $this->sampleMatches());

        $this->assertNull($out[0]['lpChange']);
    }

    public function test_rejects_implausibly_large_jump(): void
    {
        // |Δ| > 60 (decay/demote/promo sıçraması) → güvenilmez, reddedilir.
        $this->snap('B', 'GOLD', 'IV', 0);  // 1200
        $this->snap('A', 'GOLD', 'I', 0);   // 1500 → Δ=300

        $out = $this->svc->attachLpChanges($this->puuid, $this->sampleMatches());

        $this->assertNull($out[0]['lpChange']);
    }

    public function test_match_without_snapshot_stays_null(): void
    {
        // Hiç snapshot yoksa tüm lpChange null kalır (anahtar yine eklenir).
        $out = $this->svc->attachLpChanges($this->puuid, $this->sampleMatches());

        $this->assertArrayHasKey('lpChange', $out[0]);
        $this->assertNull($out[0]['lpChange']);
        $this->assertNull($out[1]['lpChange']);
    }
}
