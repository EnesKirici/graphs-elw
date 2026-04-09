<?php

namespace App\Services\RiotApi;

/**
 * Koridor bazlı analiz — iki takımın aynı roldeki oyuncularını karşılaştırır.
 *
 * Her metrik normalize edilir (-1 ile +1 arası) ve rol ağırlığıyla çarpılır.
 * Pozitif skor = mavi üstün, negatif = kırmızı üstün.
 *
 * 9 metrik: KDA, CS, Gold, Hasar, AlınanHasar, KuleHasarı, ObjHasarı, Görüş, İyileştirme
 */
class LaneAnalysisService
{
    private const ROLE_LABELS = [
        'TOP' => 'Top', 'JUNGLE' => 'Orman', 'MIDDLE' => 'Orta',
        'BOTTOM' => 'Alt', 'UTILITY' => 'Destek',
    ];

    private const WEIGHTS = [
        'TOP' => [
            'kda' => 3.0, 'cs' => 2.5, 'gold' => 2.0, 'damage' => 2.5,
            'damageTaken' => 1.5, 'towerDmg' => 2.0, 'objDmg' => 0.5,
            'vision' => 1.5, 'healing' => 0.5,
        ],
        'JUNGLE' => [
            'kda' => 3.0, 'cs' => 1.5, 'gold' => 2.0, 'damage' => 2.0,
            'damageTaken' => 1.0, 'towerDmg' => 1.0, 'objDmg' => 3.5,
            'vision' => 2.5, 'healing' => 0.5,
        ],
        'MIDDLE' => [
            'kda' => 3.0, 'cs' => 2.5, 'gold' => 2.0, 'damage' => 3.0,
            'damageTaken' => 0.5, 'towerDmg' => 1.5, 'objDmg' => 0.5,
            'vision' => 1.5, 'healing' => 0.5,
        ],
        'BOTTOM' => [
            'kda' => 3.0, 'cs' => 3.0, 'gold' => 2.5, 'damage' => 3.5,
            'damageTaken' => 0.5, 'towerDmg' => 1.5, 'objDmg' => 0.5,
            'vision' => 1.5, 'healing' => 0.5,
        ],
        'UTILITY' => [
            'kda' => 3.0, 'cs' => 0.0, 'gold' => 1.0, 'damage' => 1.0,
            'damageTaken' => 2.5, 'towerDmg' => 0.5, 'objDmg' => 0.5,
            'vision' => 3.5, 'healing' => 2.5,
        ],
    ];

    /**
     * İki takımın rol bazlı karşılaştırma analizini döner.
     */
    public function buildAnalysis(array $team100, array $team200, int $duration): array
    {
        $roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
        $analysis = [];
        $minutes = max($duration / 60, 1);

        foreach ($roles as $role) {
            $blue = null;
            $red  = null;
            foreach ($team100 as $p) {
                if ($p['role'] === $role) { $blue = $p; break; }
            }
            foreach ($team200 as $p) {
                if ($p['role'] === $role) { $red = $p; break; }
            }
            if (!$blue || !$red) continue;

            $w = self::WEIGHTS[$role];
            $factors = [];
            $score = 0;

            // KDA
            $bKda = $blue['deaths'] > 0 ? ($blue['kills'] + $blue['assists']) / $blue['deaths'] : ($blue['kills'] + $blue['assists']);
            $rKda = $red['deaths'] > 0 ? ($red['kills'] + $red['assists']) / $red['deaths'] : ($red['kills'] + $red['assists']);
            $kdaDiff = $bKda - $rKda;
            $kdaScore = max(-1, min(1, $kdaDiff / 3)) * $w['kda'];
            $score += $kdaScore;
            if (abs($kdaScore) > 0.5) $factors[] = ['metric' => 'KDA', 'value' => round($kdaScore, 1)];

            // CS
            $csDiff = $blue['cs'] - $red['cs'];
            $csNorm = max(-1, min(1, ($csDiff / $minutes) / 3));
            $csScore = $csNorm * $w['cs'];
            $score += $csScore;
            if (abs($csScore) > 0.5) $factors[] = ['metric' => 'CS', 'value' => round($csScore, 1)];

            // Gold
            $goldDiff = $blue['gold'] - $red['gold'];
            $goldNorm = max(-1, min(1, $goldDiff / 4000));
            $goldScore = $goldNorm * $w['gold'];
            $score += $goldScore;
            if (abs($goldScore) > 0.5) $factors[] = ['metric' => 'Gold', 'value' => round($goldScore, 1)];

            // Verilen hasar
            $dmgDiff = $blue['damage'] - $red['damage'];
            $dmgNorm = max(-1, min(1, $dmgDiff / 8000));
            $dmgScore = $dmgNorm * $w['damage'];
            $score += $dmgScore;
            if (abs($dmgScore) > 0.5) $factors[] = ['metric' => 'Hasar', 'value' => round($dmgScore, 1)];

            // Alınan hasar — tüm roller için fazla almak aktiflik göstergesi
            // Ağırlık farkıyla dengelenir (Top/JG/Sup yüksek, carry düşük)
            $dtDiff = ($blue['damageTaken'] ?? 0) - ($red['damageTaken'] ?? 0);
            $dtNorm = max(-1, min(1, $dtDiff / 10000));
            $dtScore = $dtNorm * $w['damageTaken'];
            $score += $dtScore;
            if (abs($dtScore) > 0.3) $factors[] = ['metric' => 'Alınan Hasar', 'value' => round($dtScore, 1)];

            // Kule hasarı
            $twrDiff = ($blue['towerDamage'] ?? 0) - ($red['towerDamage'] ?? 0);
            $twrNorm = max(-1, min(1, $twrDiff / 5000));
            $twrScore = $twrNorm * $w['towerDmg'];
            $score += $twrScore;
            if (abs($twrScore) > 0.3) $factors[] = ['metric' => 'Kule Hasarı', 'value' => round($twrScore, 1)];

            // Objective hasarı
            $objDiff = ($blue['objectiveDamage'] ?? 0) - ($red['objectiveDamage'] ?? 0);
            $objNorm = max(-1, min(1, $objDiff / 15000));
            $objScore = $objNorm * $w['objDmg'];
            $score += $objScore;
            if (abs($objScore) > 0.3) $factors[] = ['metric' => 'Obj. Hasarı', 'value' => round($objScore, 1)];

            // Görüş (birleşik: vision score %60 + ward activity %40)
            $bVis = ($blue['visionScore'] ?? 0);
            $rVis = ($red['visionScore'] ?? 0);
            $bWards = ($blue['wardsPlaced'] ?? 0) + ($blue['wardsKilled'] ?? 0);
            $rWards = ($red['wardsPlaced'] ?? 0) + ($red['wardsKilled'] ?? 0);
            $visDivisor = in_array($role, ['UTILITY', 'JUNGLE']) ? 10 : 20;
            $wardDivisor = in_array($role, ['UTILITY', 'JUNGLE']) ? 8 : 15;
            $visNorm = max(-1, min(1, ($bVis - $rVis) / $visDivisor));
            $wardNorm = max(-1, min(1, ($bWards - $rWards) / $wardDivisor));
            $combinedVision = ($visNorm * 0.6 + $wardNorm * 0.4);
            $visScore = $combinedVision * $w['vision'];
            $score += $visScore;
            if (abs($visScore) > 0.3) $factors[] = ['metric' => 'Görüş', 'value' => round($visScore, 1)];

            // İyileştirme + Kalkan
            $bHeal = $blue['teamHealing'] ?? 0;
            $rHeal = $red['teamHealing'] ?? 0;
            $healDiff = $bHeal - $rHeal;
            $healNorm = max(-1, min(1, $healDiff / 8000));
            $healScore = $healNorm * $w['healing'];
            $score += $healScore;
            if (abs($healScore) > 0.3) $factors[] = ['metric' => 'İyileştirme', 'value' => round($healScore, 1)];

            // Verdict
            if ($score > 5) {
                $verdict = 'blue_dominant';
            } elseif ($score > 2) {
                $verdict = 'blue_ahead';
            } elseif ($score < -5) {
                $verdict = 'red_dominant';
            } elseif ($score < -2) {
                $verdict = 'red_ahead';
            } else {
                $verdict = 'even';
            }

            // Öne çıkan istatistikler
            $highlights = [];
            if (abs($csDiff) >= 15) {
                $highlights[] = ($csDiff > 0 ? '+' : '') . $csDiff . ' CS';
            }
            if (abs($goldDiff) >= 1000) {
                $highlights[] = ($goldDiff > 0 ? '+' : '') . round($goldDiff / 1000, 1) . 'k gold';
            }
            if (abs($blue['kills'] - $red['kills']) >= 2) {
                $kDiff = $blue['kills'] - $red['kills'];
                $highlights[] = ($kDiff > 0 ? '+' : '') . $kDiff . ' kill';
            }

            usort($factors, fn($a, $b) => abs($b['value']) <=> abs($a['value']));

            $analysis[] = [
                'role'       => $role,
                'label'      => self::ROLE_LABELS[$role] ?? $role,
                'bluePlayer' => $blue['summonerName'],
                'redPlayer'  => $red['summonerName'],
                'csDiff'     => $csDiff,
                'goldDiff'   => $goldDiff,
                'dmgDiff'    => $dmgDiff,
                'verdict'    => $verdict,
                'highlights' => $highlights,
                'factors'    => array_slice($factors, 0, 3),
                'score'      => round($score, 1),
            ];
        }

        return $analysis;
    }
}
