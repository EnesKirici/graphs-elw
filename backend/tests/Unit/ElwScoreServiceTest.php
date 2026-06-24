<?php

namespace Tests\Unit;

use App\Services\RiotApi\ElwScoreService;
use PHPUnit\Framework\TestCase;

/**
 * ElwScoreService — maç performans puanı (0–10) + lobi içi sıralama.
 * Ürünün çekirdek metriği. Birim testleri NİTEL doğruluğu sabitler:
 *   - taşıyan oyuncu (carry) en üstte ve yüksek puan,
 *   - feed eden en altta ve düşük puan,
 *   - tüm puanlar 0–10 aralığında.
 */
class ElwScoreServiceTest extends TestCase
{
    private ElwScoreService $svc;

    protected function setUp(): void
    {
        $this->svc = new ElwScoreService();
    }

    /** Tek bir katılımcı — varsayılan "ortalama" oyuncu; $o ile alanlar ezilir. */
    private function participant(string $puuid, array $o = []): array
    {
        return array_merge([
            'puuid' => $puuid,
            'kills' => 5, 'deaths' => 5, 'assists' => 5,
            'win' => true,
            'teamPosition' => 'MIDDLE', 'individualPosition' => 'MIDDLE',
            'totalHealsOnTeammates' => 0,
            'totalDamageShieldedOnTeammates' => 0,
            'totalDamageDealtToChampions' => 15000,
            'timeCCingOthers' => 10,
            'damageDealtToTurrets' => 2000,
            'damageDealtToObjectives' => 5000,
            'challenges' => [
                'damagePerMinute' => 600,
                'goldPerMinute' => 350,
                'killParticipation' => 0.5,
                'visionScorePerMinute' => 1.0,
                'damageTakenOnTeamPercentage' => 0.2,
            ],
        ], $o);
    }

    /** 10 kişilik lobi: 'carry' (üstün, kazanır), 8 ortalama, 'feeder' (feed, kaybeder). */
    private function lobby(): array
    {
        $ps = [];
        $ps[] = $this->participant('carry', [
            'kills' => 15, 'deaths' => 2, 'assists' => 10, 'win' => true,
            'totalDamageDealtToChampions' => 40000,
            'damageDealtToTurrets' => 8000,
            'challenges' => [
                'damagePerMinute' => 1400, 'goldPerMinute' => 650,
                'killParticipation' => 0.80, 'visionScorePerMinute' => 1.5,
                'damageTakenOnTeamPercentage' => 0.20,
            ],
        ]);
        for ($i = 2; $i <= 9; $i++) {
            $ps[] = $this->participant("avg{$i}", ['win' => $i <= 5]);
        }
        $ps[] = $this->participant('feeder', [
            'kills' => 0, 'deaths' => 14, 'assists' => 1, 'win' => false,
            'totalDamageDealtToChampions' => 4000,
            'damageDealtToTurrets' => 0, 'damageDealtToObjectives' => 0,
            'challenges' => [
                'damagePerMinute' => 150, 'goldPerMinute' => 200,
                'killParticipation' => 0.20, 'visionScorePerMinute' => 0.5,
                'damageTakenOnTeamPercentage' => 0.10,
            ],
        ]);

        return $ps;
    }

    public function test_carry_ranks_first_with_high_score(): void
    {
        $r = $this->svc->calculateMatchRanking($this->lobby(), 'carry', 1800);

        $this->assertSame(1, $r['rank']);
        $this->assertGreaterThanOrEqual(6.0, $r['elwScore']);
        $this->assertLessThanOrEqual(10.0, $r['elwScore']);
    }

    public function test_feeder_ranks_last_with_low_score(): void
    {
        $r = $this->svc->calculateMatchRanking($this->lobby(), 'feeder', 1800);

        $this->assertSame(10, $r['rank']);
        $this->assertGreaterThanOrEqual(0.0, $r['elwScore']);
        $this->assertLessThanOrEqual(4.5, $r['elwScore']);
    }

    public function test_all_scores_bounded_and_carry_beats_feeder(): void
    {
        $scores = $this->svc->calculateAllElwScores($this->lobby(), 1800, 'individual');

        $this->assertCount(10, $scores);
        foreach ($scores as $puuid => $score) {
            $this->assertGreaterThanOrEqual(0.0, $score, "puuid={$puuid}");
            $this->assertLessThanOrEqual(10.0, $score, "puuid={$puuid}");
        }
        $this->assertGreaterThan($scores['feeder'], $scores['carry']);
    }

    public function test_team_mode_scores_also_bounded(): void
    {
        $scores = $this->svc->calculateAllElwScores($this->lobby(), 1800, 'team');

        $this->assertCount(10, $scores);
        foreach ($scores as $score) {
            $this->assertGreaterThanOrEqual(0.0, $score);
            $this->assertLessThanOrEqual(10.0, $score);
        }
    }
}
