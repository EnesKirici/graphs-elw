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

    public function __construct(
        private DataDragonService $ddragon,
    ) {}

    /**
     * Maç ÖZETİ için hafif koridor/takım analizi (profil listesi kartı alanları):
     * koridor rakibi/eşi, takım kalitesi (ELW farkı), KP, CS/dk, koridor CS farkı.
     * Detaylı 9-metrik buildAnalysis'ten ayrıdır.
     *
     * @param array $teamScores puuid => takım-ağırlıklı ELW (0-10)
     */
    public function summarizeForPlayer(array $info, array $player, string $puuid, array $teamScores): array
    {
        $playerTeam = $player['teamId'];
        $myRole = $player['teamPosition'] ?? '';
        $partnerRoleMap = ['TOP' => 'JUNGLE', 'MIDDLE' => 'JUNGLE', 'JUNGLE' => 'MIDDLE', 'BOTTOM' => 'UTILITY', 'UTILITY' => 'BOTTOM'];
        $partnerRole = $partnerRoleMap[$myRole] ?? '';

        $laneOpponent = null;
        $laneOpponentCs = null;
        $laneDuo = null;
        $enemyDuo = null;
        $myTeamSum = 0; $myTeamCount = 0;
        $enemySum = 0;  $enemyCount = 0;
        $teamKills = 0;

        $champEntry = fn ($p, $role) => [
            'name'     => $p['championName'],
            'image'    => $this->ddragon->championIconUrl($p['championName']),
            'gameName' => $p['riotIdGameName'] ?? $p['summonerName'] ?? '?',
            'tagLine'  => $p['riotIdTagline'] ?? '',
            'role'     => $role,
        ];

        foreach ($info['participants'] as $p) {
            $pPos = $p['teamPosition'] ?? '';
            if ($p['teamId'] === $playerTeam) {
                $teamKills += $p['kills'];
                if ($p['puuid'] !== $puuid) {
                    $myTeamSum += $teamScores[$p['puuid']] ?? 5;
                    $myTeamCount++;
                    if ($partnerRole && !$laneDuo && $pPos === $partnerRole) {
                        $laneDuo = $champEntry($p, $partnerRole);
                    }
                }
            } else {
                $enemySum += $teamScores[$p['puuid']] ?? 5;
                $enemyCount++;
                if ($myRole && !$laneOpponent && $pPos === $myRole) {
                    $laneOpponent = $champEntry($p, $myRole);
                    $laneOpponentCs = ($p['totalMinionsKilled'] ?? 0) + ($p['neutralMinionsKilled'] ?? 0);
                }
                if ($partnerRole && !$enemyDuo && $pPos === $partnerRole) {
                    $enemyDuo = $champEntry($p, $partnerRole);
                }
            }
        }

        // Takım kalitesi — DPM tarzı: takım arkadaşlarımın (ben hariç) MUTLAK seviyesi.
        // diff = takım arkadaşları ort ELW − lobi ortalaması (10 oyuncu). "Arkadaşlarım lobi
        // seviyesinin üstünde mi/altında mı." Per-player (beni çıkarınca): carry çıkınca takım
        // ortalama görünür → "Ortalama"; zayıf çıkınca carry'ler kalır → "İyi"; herkes kötü → "Kötü".
        $teamQuality = null;
        if ($myTeamCount > 0 && $enemyCount > 0) {
            $myScore = $teamScores[$puuid] ?? 5;
            $teammatesAvg = $myTeamSum / $myTeamCount;
            $lobbyAvg = ($myTeamSum + $myScore + $enemySum) / ($myTeamCount + 1 + $enemyCount);
            $diff = $teammatesAvg - $lobbyAvg;
            $t = config('elwgraphs.team_quality');
            // MUTLAK taban: relatif diff lobiyle sınırlı (lobi kendi kötü takımımı da içerir),
            // 0/10-1/10 hard-inter'li takım -1.7'ye ulaşamayabilir → takım arkadaşlarının MUTLAK
            // ortalaması bunun altındaysa relatiften bağımsız "Çok kötü takım".
            $terribleAbs = $t['terrible_abs'] ?? 3.8;
            if ($diff >= $t['great']) {
                $teamQuality = ['key' => 'great', 'label' => 'Çok iyi takım'];
            } elseif ($diff >= $t['good']) {
                $teamQuality = ['key' => 'good', 'label' => 'İyi takım'];
            } elseif ($diff > $t['bad'] && $teammatesAvg > $terribleAbs) {
                $teamQuality = ['key' => 'avg', 'label' => 'Ortalama takım'];
            } elseif ($diff > $t['terrible'] && $teammatesAvg > $terribleAbs) {
                $teamQuality = ['key' => 'bad', 'label' => 'Kötü takım'];
            } else {
                $teamQuality = ['key' => 'terrible', 'label' => 'Çok kötü takım'];
            }
            $teamQuality['diff'] = round($diff, 2);
            $teamQuality['teammatesAvg'] = round($teammatesAvg, 1);
            $teamQuality['lobbyAvg'] = round($lobbyAvg, 1);
        }

        $kp = $teamKills > 0 ? (int) round(($player['kills'] + $player['assists']) / $teamKills * 100) : 0;
        $totalCs = $player['totalMinionsKilled'] + ($player['neutralMinionsKilled'] ?? 0);
        $csPerMin = ($info['gameDuration'] ?? 0) > 0 ? round($totalCs / ($info['gameDuration'] / 60), 1) : 0;
        $csDiff = ($laneOpponent && $laneOpponentCs !== null) ? ($totalCs - $laneOpponentCs) : null;

        return [
            'laneOpponent' => $laneOpponent,
            'laneDuo'      => $laneDuo,
            'enemyDuo'     => $enemyDuo,
            'partnerRole'  => $partnerRole,
            'teamQuality'  => $teamQuality,
            'kp'           => $kp,
            'csPerMin'     => $csPerMin,
            'csDiff'       => $csDiff,
        ];
    }

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

            // Öne çıkan istatistikler — rol bazlı + genel
            $highlights = $this->generateRoleHighlights($role, $blue, $red, $minutes);

            // Genel fark highlights
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
            $highlights = array_slice($highlights, 0, 5);

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

    /**
     * Rol bazlı detaylı highlights üret.
     * Format: "Metrik: X vs Y" → frontend swap'ta X↔Y çevrilir.
     */
    private function generateRoleHighlights(string $role, array $blue, array $red, float $minutes): array
    {
        $h = [];

        // ===== ROL BAZLI HIGHLIGHTS =====

        if ($role === 'JUNGLE') {
            // Objektif çalma
            $bSteals = $blue['challenges']['epicMonsterSteals'] ?? 0;
            $rSteals = $red['challenges']['epicMonsterSteals'] ?? 0;
            if ($bSteals > 0 || $rSteals > 0) {
                $h[] = "Obj. çalma: {$bSteals} vs {$rSteals}";
            }

            // Ejder katılımı
            $bDragon = $blue['challenges']['dragonTakedowns'] ?? 0;
            $rDragon = $red['challenges']['dragonTakedowns'] ?? 0;
            if ($bDragon + $rDragon > 0) {
                $h[] = "Ejder: {$bDragon} vs {$rDragon}";
            }

            // Baron katılımı
            $bBaron = $blue['challenges']['baronTakedowns'] ?? 0;
            $rBaron = $red['challenges']['baronTakedowns'] ?? 0;
            if ($bBaron > 0 || $rBaron > 0) {
                $h[] = "Baron: {$bBaron} vs {$rBaron}";
            }

            // Herald katılımı
            $bHerald = $blue['challenges']['riftHeraldTakedowns'] ?? 0;
            $rHerald = $red['challenges']['riftHeraldTakedowns'] ?? 0;
            if ($bHerald + $rHerald > 0 && abs($bHerald - $rHerald) >= 1) {
                $h[] = "Herald: {$bHerald} vs {$rHerald}";
            }

            // Görüş skoru
            $bVis = $blue['visionScore'] ?? 0;
            $rVis = $red['visionScore'] ?? 0;
            if (abs($bVis - $rVis) >= 10) {
                $h[] = "Görüş: {$bVis} vs {$rVis}";
            }
        }

        if ($role === 'TOP') {
            // Solo kill
            $bSolo = $blue['challenges']['soloKills'] ?? 0;
            $rSolo = $red['challenges']['soloKills'] ?? 0;
            if ($bSolo > 0 || $rSolo > 0) {
                $h[] = "Solo kill: {$bSolo} vs {$rSolo}";
            }

            // Kule plakaları
            $bPlates = $blue['challenges']['turretPlatesTaken'] ?? 0;
            $rPlates = $red['challenges']['turretPlatesTaken'] ?? 0;
            if (abs($bPlates - $rPlates) >= 2) {
                $h[] = "Plaka: {$bPlates} vs {$rPlates}";
            }

            // 10dk CS farkı
            $bCS10 = $blue['challenges']['laneMinions10'] ?? 0;
            $rCS10 = $red['challenges']['laneMinions10'] ?? 0;
            if ($bCS10 > 0 && $rCS10 > 0 && abs($bCS10 - $rCS10) >= 10) {
                $h[] = "10dk CS: {$bCS10} vs {$rCS10}";
            }

            // Kule hasarı
            $bTwr = $blue['towerDamage'] ?? 0;
            $rTwr = $red['towerDamage'] ?? 0;
            if (abs($bTwr - $rTwr) >= 2000) {
                $h[] = "Kule hasarı: " . round($bTwr / 1000, 1) . "k vs " . round($rTwr / 1000, 1) . "k";
            }
        }

        if ($role === 'MIDDLE') {
            // Solo kill
            $bSolo = $blue['challenges']['soloKills'] ?? 0;
            $rSolo = $red['challenges']['soloKills'] ?? 0;
            if ($bSolo > 0 || $rSolo > 0) {
                $h[] = "Solo kill: {$bSolo} vs {$rSolo}";
            }

            // DPM karşılaştırma
            $bDPM = $blue['challenges']['damagePerMinute'] ?? 0;
            $rDPM = $red['challenges']['damagePerMinute'] ?? 0;
            if (abs($bDPM - $rDPM) >= 150) {
                $h[] = "DPM: " . round($bDPM) . " vs " . round($rDPM);
            }

            // 10dk CS farkı
            $bCS10 = $blue['challenges']['laneMinions10'] ?? 0;
            $rCS10 = $red['challenges']['laneMinions10'] ?? 0;
            if ($bCS10 > 0 && $rCS10 > 0 && abs($bCS10 - $rCS10) >= 10) {
                $h[] = "10dk CS: {$bCS10} vs {$rCS10}";
            }
        }

        if ($role === 'BOTTOM') {
            // DPM karşılaştırma
            $bDPM = $blue['challenges']['damagePerMinute'] ?? 0;
            $rDPM = $red['challenges']['damagePerMinute'] ?? 0;
            if (abs($bDPM - $rDPM) >= 150) {
                $h[] = "DPM: " . round($bDPM) . " vs " . round($rDPM);
            }

            // 10dk CS farkı
            $bCS10 = $blue['challenges']['laneMinions10'] ?? 0;
            $rCS10 = $red['challenges']['laneMinions10'] ?? 0;
            if ($bCS10 > 0 && $rCS10 > 0 && abs($bCS10 - $rCS10) >= 10) {
                $h[] = "10dk CS: {$bCS10} vs {$rCS10}";
            }

            // Kule plakaları
            $bPlates = $blue['challenges']['turretPlatesTaken'] ?? 0;
            $rPlates = $red['challenges']['turretPlatesTaken'] ?? 0;
            if (abs($bPlates - $rPlates) >= 2) {
                $h[] = "Plaka: {$bPlates} vs {$rPlates}";
            }
        }

        if ($role === 'UTILITY') {
            // Totem skoru
            $bVis = $blue['visionScore'] ?? 0;
            $rVis = $red['visionScore'] ?? 0;
            if (abs($bVis - $rVis) >= 8) {
                $h[] = "Totem: {$bVis} vs {$rVis}";
            }

            // Kontrol ward
            $bCW = $blue['challenges']['controlWardsPlaced'] ?? 0;
            $rCW = $red['challenges']['controlWardsPlaced'] ?? 0;
            if ($bCW + $rCW > 0) {
                $h[] = "Kontrol ward: {$bCW} vs {$rCW}";
            }

            // Ward aktivitesi (koyulan + yok edilen)
            $bWards = ($blue['wardsPlaced'] ?? 0) + ($blue['wardsKilled'] ?? 0);
            $rWards = ($red['wardsPlaced'] ?? 0) + ($red['wardsKilled'] ?? 0);
            if (abs($bWards - $rWards) >= 8) {
                $h[] = "Ward: {$bWards} vs {$rWards}";
            }

            // İyileştirme + kalkan
            $bHeal = $blue['teamHealing'] ?? 0;
            $rHeal = $red['teamHealing'] ?? 0;
            if ($bHeal + $rHeal > 0 && abs($bHeal - $rHeal) >= 2000) {
                $h[] = "İyileştirme: " . round($bHeal / 1000, 1) . "k vs " . round($rHeal / 1000, 1) . "k";
            }
        }

        // ===== TÜM ROLLER İÇİN ORTAK =====

        // 1v2+ Kill (outnumberedKills — sayıca az iken alınan kill, ör: 1v2, 1v3)
        $bOut = $blue['challenges']['outnumberedKills'] ?? 0;
        $rOut = $red['challenges']['outnumberedKills'] ?? 0;
        if ($bOut > 0 || $rOut > 0) {
            $h[] = "1v2+ Kill: {$bOut} vs {$rOut}";
        }

        // Multi kill — Penta > Quadra > Triple
        $bPenta = $blue['pentaKills'] ?? 0;
        $rPenta = $red['pentaKills'] ?? 0;
        $bQuadra = $blue['quadraKills'] ?? 0;
        $rQuadra = $red['quadraKills'] ?? 0;
        $bTriple = $blue['tripleKills'] ?? 0;
        $rTriple = $red['tripleKills'] ?? 0;
        if ($bPenta > 0 || $rPenta > 0) {
            $h[] = "Penta Kill: {$bPenta} vs {$rPenta}";
        } elseif ($bQuadra > 0 || $rQuadra > 0) {
            $h[] = "Quadra Kill: {$bQuadra} vs {$rQuadra}";
        } elseif ($bTriple > 0 || $rTriple > 0) {
            $h[] = "Triple Kill: {$bTriple} vs {$rTriple}";
        }

        // Kill participation (tüm roller — yeterince fark varsa)
        $bKP = $blue['killParticipation'] ?? 0;
        $rKP = $red['killParticipation'] ?? 0;
        if (abs($bKP - $rKP) >= 15) {
            $h[] = "KP: %{$bKP} vs %{$rKP}";
        }

        return $h;
    }
}
