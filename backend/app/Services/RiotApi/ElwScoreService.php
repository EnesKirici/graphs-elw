<?php

namespace App\Services\RiotApi;

/**
 * ELW Score Algoritması — 10 üzerinden performans puanı.
 *
 * İki sıralama modu: Bireysel Performans ve Takım Katkısı.
 *
 * 9 Metrik (her biri normalize edilir: 0.0–1.0 arası):
 *   KDA, DPM, GPM, KP, Görüş/dk, Kule Hasarı, Obj Hasarı, Tank Katkısı, İyileştirme
 *
 * Z-Score Normalizasyon:
 *   Ham skorlar maç ortalamasına göre normalize edilir.
 *   Final = 5.0 + (z-score × 1.8), 0–10 arası sınırlandırılır.
 */
class ElwScoreService
{
    // ===== BİREYSEL PERFORMANS — carry metrikleri ön planda =====
    //                       kda  dpm  gpm  kp   vision tower  obj   tank  heal  = 12.0
    private const INDIVIDUAL_WEIGHTS = [
        'TOP'     => ['kda' => 2.5, 'dpm' => 2.0, 'gpm' => 1.5, 'kp' => 1.0, 'vision' => 1.0, 'towerDmg' => 2.0, 'objDmg' => 0.5, 'tankPct' => 1.5, 'healing' => 0.0],
        'JUNGLE'  => ['kda' => 2.5, 'dpm' => 1.5, 'gpm' => 1.5, 'kp' => 1.5, 'vision' => 1.0, 'towerDmg' => 0.5, 'objDmg' => 2.5, 'tankPct' => 1.0, 'healing' => 0.0],
        'MIDDLE'  => ['kda' => 2.5, 'dpm' => 2.5, 'gpm' => 2.0, 'kp' => 2.0, 'vision' => 1.0, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'BOTTOM'  => ['kda' => 2.5, 'dpm' => 3.0, 'gpm' => 2.0, 'kp' => 2.0, 'vision' => 0.5, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'UTILITY' => ['kda' => 2.0, 'dpm' => 0.5, 'gpm' => 0.5, 'kp' => 2.0, 'vision' => 3.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 1.5, 'healing' => 2.0],
    ];

    // ===== TAKIM KATKISI — KP/Vision/Tank ön planda =====
    //                       kda  dpm  gpm  kp   vision tower  obj   tank  heal  = 12.0
    private const TEAM_WEIGHTS = [
        'TOP'     => ['kda' => 2.0, 'dpm' => 1.5, 'gpm' => 1.0, 'kp' => 2.0, 'vision' => 1.5, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 2.0, 'healing' => 0.0],
        'JUNGLE'  => ['kda' => 1.5, 'dpm' => 1.0, 'gpm' => 1.0, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 0.5, 'objDmg' => 2.5, 'tankPct' => 1.0, 'healing' => 0.0],
        'MIDDLE'  => ['kda' => 2.0, 'dpm' => 2.0, 'gpm' => 1.5, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'BOTTOM'  => ['kda' => 1.5, 'dpm' => 2.5, 'gpm' => 1.5, 'kp' => 3.0, 'vision' => 1.0, 'towerDmg' => 2.0, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'UTILITY' => ['kda' => 1.5, 'dpm' => 0.5, 'gpm' => 0.5, 'kp' => 3.0, 'vision' => 3.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 1.0, 'healing' => 2.0],
    ];

    private const DEFAULT_INDIVIDUAL_W = ['kda' => 2.5, 'dpm' => 2.0, 'gpm' => 1.5, 'kp' => 2.0, 'vision' => 1.0, 'towerDmg' => 1.0, 'objDmg' => 1.0, 'tankPct' => 0.5, 'healing' => 0.5];
    private const DEFAULT_TEAM_W       = ['kda' => 2.0, 'dpm' => 1.5, 'gpm' => 1.0, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 1.0, 'objDmg' => 1.0, 'tankPct' => 0.5, 'healing' => 0.5];

    /**
     * Tüm 10 oyuncunun ELW Score'unu hesapla — puuid → score map döner.
     * @param string $mode 'individual' veya 'team'
     */
    public function calculateAllElwScores(array $participants, int $duration, string $mode = 'individual'): array
    {
        $roleWeights = $mode === 'team' ? self::TEAM_WEIGHTS : self::INDIVIDUAL_WEIGHTS;
        $defaultW = $mode === 'team' ? self::DEFAULT_TEAM_W : self::DEFAULT_INDIVIDUAL_W;
        $minutes = max($duration / 60, 1);

        $scores = [];
        foreach ($participants as $p) {
            $deaths = max($p['deaths'], 1);
            $c = $p['challenges'] ?? [];
            $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
            if ($role === 'BOT') $role = 'BOTTOM';
            $w = $roleWeights[$role] ?? $defaultW;

            $kda = ($p['kills'] + $p['assists']) / $deaths;
            $kdaNorm = min(log($kda + 1) / log(10), 1);
            $dpmNorm = min(($c['damagePerMinute'] ?? 0) / 1500, 1);
            $gpmNorm = min(($c['goldPerMinute'] ?? 0) / 700, 1);
            $kp = ($c['killParticipation'] ?? 0);
            $vsNorm = min(($c['visionScorePerMinute'] ?? 0) / 3.0, 1);
            $towerNorm = min(($p['damageDealtToTurrets'] ?? 0) / 10000, 1);
            $objNorm = min(($p['damageDealtToObjectives'] ?? 0) / 30000, 1);
            $tankPct = ($c['damageTakenOnTeamPercentage'] ?? 0);
            $healNorm = min((($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0)) / $minutes / 800, 1);

            $score = $kdaNorm * $w['kda'] + $dpmNorm * $w['dpm'] + $gpmNorm * $w['gpm'] + $kp * $w['kp']
                   + $vsNorm * $w['vision'] + $towerNorm * $w['towerDmg'] + $objNorm * $w['objDmg']
                   + $tankPct * $w['tankPct'] + $healNorm * $w['healing'];

            $scores[] = ['puuid' => $p['puuid'], 'score' => $score];
        }

        return $this->normalizeScores($scores);
    }

    /**
     * Tek oyuncu için ELW Score + sıralama hesapla (maç kartlarında kullanılır).
     * Bireysel mod ağırlıklarını kullanır.
     */
    public function calculateMatchRanking(array $participants, string $puuid, int $duration = 0): array
    {
        $roleWeights = self::INDIVIDUAL_WEIGHTS;
        $defaultW = self::DEFAULT_INDIVIDUAL_W;
        $minutes = max($duration / 60, 1);

        $scores = [];
        foreach ($participants as $p) {
            $deaths = max($p['deaths'], 1);
            $c = $p['challenges'] ?? [];
            $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
            if ($role === 'BOT') $role = 'BOTTOM';
            $w = $roleWeights[$role] ?? $defaultW;

            $kda = ($p['kills'] + $p['assists']) / $deaths;
            $kdaNorm = min(log($kda + 1) / log(10), 1);
            $dpmNorm = min(($c['damagePerMinute'] ?? 0) / 1500, 1);
            $gpmNorm = min(($c['goldPerMinute'] ?? 0) / 700, 1);
            $kp = ($c['killParticipation'] ?? 0);
            $vsNorm = min(($c['visionScorePerMinute'] ?? 0) / 3.0, 1);
            $towerNorm = min(($p['damageDealtToTurrets'] ?? 0) / 10000, 1);
            $objNorm = min(($p['damageDealtToObjectives'] ?? 0) / 30000, 1);
            $tankPct = ($c['damageTakenOnTeamPercentage'] ?? 0);
            $healNorm = min((($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0)) / $minutes / 800, 1);

            $score = $kdaNorm * $w['kda'] + $dpmNorm * $w['dpm'] + $gpmNorm * $w['gpm'] + $kp * $w['kp']
                   + $vsNorm * $w['vision'] + $towerNorm * $w['towerDmg'] + $objNorm * $w['objDmg']
                   + $tankPct * $w['tankPct'] + $healNorm * $w['healing'];

            $scores[] = ['puuid' => $p['puuid'], 'score' => $score];
        }

        // Z-score normalize
        $rawScores = array_column($scores, 'score');
        $avg = array_sum($rawScores) / max(count($rawScores), 1);
        $variance = 0;
        foreach ($rawScores as $rs) { $variance += ($rs - $avg) ** 2; }
        $stdDev = max(sqrt($variance / max(count($rawScores), 1)), 0.5);

        foreach ($scores as &$s) {
            $z = ($s['score'] - $avg) / $stdDev;
            $s['elwScore'] = round(max(0, min(10, 5 + $z * 1.8)), 1);
        }
        unset($s);

        usort($scores, fn($a, $b) => $b['score'] <=> $a['score']);

        $rank = 1;
        $myScore = 0;
        foreach ($scores as $i => $s) {
            if ($s['puuid'] === $puuid) {
                $rank = $i + 1;
                $myScore = $s['elwScore'];
                break;
            }
        }

        return [
            'rank'     => $rank,
            'elwScore' => $myScore,
        ];
    }

    /**
     * Timeline verisinden performans etiketi hesapla.
     */
    public function calculatePerformanceLabel(array $ranking, array $player, array $info, ?array $timeline): ?array
    {
        $rank = $ranking['rank'];
        $win = $player['win'];
        $kda = $player['deaths'] > 0
            ? ($player['kills'] + $player['assists']) / $player['deaths']
            : ($player['kills'] + $player['assists']);
        $minutes = max(($info['gameDuration'] ?? 1) / 60, 1);

        $earlyGoldLead = null;
        $lateGoldLead = null;

        if ($timeline && isset($timeline['info']['frames'])) {
            $frames = $timeline['info']['frames'];
            $participantId = null;

            foreach ($info['participants'] as $i => $p) {
                if ($p['puuid'] === $player['puuid']) {
                    $participantId = $i + 1;
                    break;
                }
            }

            if ($participantId) {
                $pid = (string) $participantId;

                $getAvgGold = function ($frame) {
                    $golds = [];
                    foreach ($frame['participantFrames'] as $pf) {
                        $golds[] = $pf['totalGold'] ?? 0;
                    }
                    return count($golds) > 0 ? array_sum($golds) / count($golds) : 0;
                };

                $earlyFrame = $frames[min(10, count($frames) - 1)] ?? null;
                if ($earlyFrame && isset($earlyFrame['participantFrames'][$pid])) {
                    $myGold = $earlyFrame['participantFrames'][$pid]['totalGold'] ?? 0;
                    $avgGold = $getAvgGold($earlyFrame);
                    $earlyGoldLead = $myGold - $avgGold;
                }

                $lastFrame = end($frames);
                if ($lastFrame && isset($lastFrame['participantFrames'][$pid])) {
                    $myGold = $lastFrame['participantFrames'][$pid]['totalGold'] ?? 0;
                    $avgGold = $getAvgGold($lastFrame);
                    $lateGoldLead = $myGold - $avgGold;
                }
            }
        }

        if ($rank <= 2 && $win && $kda >= 4) {
            return ['label' => 'Durdurulamaz', 'desc' => 'Eşsiz performans sergileyerek takımını zafere taşıdı.', 'color' => 'emerald'];
        }

        if ($rank <= 3 && $win) {
            return ['label' => 'Lider', 'desc' => 'İyi kararlar verip takımını zafere taşıdı.', 'color' => 'emerald'];
        }

        if ($earlyGoldLead !== null && $lateGoldLead !== null) {
            if ($earlyGoldLead < -300 && $lateGoldLead > 500 && $win) {
                return ['label' => 'Geç Açılan', 'desc' => 'Zaman içinde giderek artan performans göstererek zafere ulaştı.', 'color' => 'blue'];
            }

            if ($earlyGoldLead > 500 && $lateGoldLead < -200 && !$win) {
                return ['label' => 'Erken Baskın', 'desc' => 'İyi bir başlangıç yaptı ama avantajı koruyamadı.', 'color' => 'yellow'];
            }
        }

        if ($rank <= 3 && !$win) {
            return ['label' => 'Dirençli', 'desc' => 'Yenilgiye rağmen takımındaki en iyi performansı gösterdi.', 'color' => 'blue'];
        }

        if ($win && $rank >= 4 && $rank <= 6) {
            return ['label' => 'Katkıcı', 'desc' => 'Takımına istikrarlı katkı sağlayarak galibiyete yardımcı oldu.', 'color' => 'gray'];
        }

        if ($rank >= 8) {
            return ['label' => 'Mücadele', 'desc' => 'Zor bir maç geçirdi.', 'color' => 'red'];
        }

        if ($rank >= 5 && $rank <= 7) {
            return ['label' => 'Ortalama', 'desc' => 'Standart bir performans sergiledi.', 'color' => 'gray'];
        }

        return null;
    }

    /**
     * Z-score normalizasyon — ham skorları 0-10 arası puanlama.
     */
    private function normalizeScores(array $scores): array
    {
        $rawScores = array_column($scores, 'score');
        $avg = array_sum($rawScores) / max(count($rawScores), 1);
        $variance = 0;
        foreach ($rawScores as $rs) { $variance += ($rs - $avg) ** 2; }
        $stdDev = max(sqrt($variance / max(count($rawScores), 1)), 0.5);

        $result = [];
        foreach ($scores as $s) {
            $z = ($s['score'] - $avg) / $stdDev;
            $result[$s['puuid']] = round(max(0, min(10, 5 + $z * 1.8)), 1);
        }
        return $result;
    }
}
