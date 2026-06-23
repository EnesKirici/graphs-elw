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
 * Z-Score Normalizasyon (asimetrik eğri):
 *   Ham skorlar maç ortalamasına göre normalize edilir (z-score).
 *   zToElw(): base 5.4; iyi tarafta cömert (10'a sature, MVP ~9.5), kötü tarafta düşük.
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
        // Enchanter support (Lulu, Janna, Soraka...) — heal/shield ve vision ön planda
        'UTILITY_ENCHANTER' => ['kda' => 2.5, 'dpm' => 0.5, 'gpm' => 0.5, 'kp' => 2.0, 'vision' => 2.3, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 1.3, 'healing' => 1.6],
        // Hasar support (Brand, Zyra, Vel'Koz...) — hasar ve KP ön planda
        'UTILITY_DAMAGE'    => ['kda' => 2.0, 'dpm' => 2.0, 'gpm' => 0.5, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 0.5, 'healing' => 2.0],
        // Tank support (Leona, Alistar, Nautilus...) — tank katkısı (CC/önde durma) heal kadar değerli
        'UTILITY_TANK'      => ['kda' => 2.0, 'dpm' => 1.0, 'gpm' => 0.5, 'kp' => 2.5, 'vision' => 3.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 2.0, 'healing' => 0.5],
    ];

    // ===== TAKIM KATKISI — KP/Vision/Tank ön planda =====
    //                       kda  dpm  gpm  kp   vision tower  obj   tank  heal  = 12.0
    private const TEAM_WEIGHTS = [
        'TOP'     => ['kda' => 2.0, 'dpm' => 1.5, 'gpm' => 1.0, 'kp' => 2.0, 'vision' => 1.5, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 2.0, 'healing' => 0.0],
        'JUNGLE'  => ['kda' => 1.5, 'dpm' => 1.0, 'gpm' => 1.0, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 0.5, 'objDmg' => 2.5, 'tankPct' => 1.0, 'healing' => 0.0],
        'MIDDLE'  => ['kda' => 2.0, 'dpm' => 2.0, 'gpm' => 1.5, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'BOTTOM'  => ['kda' => 1.5, 'dpm' => 2.5, 'gpm' => 1.5, 'kp' => 3.0, 'vision' => 1.0, 'towerDmg' => 2.0, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'UTILITY_ENCHANTER' => ['kda' => 1.5, 'dpm' => 0.5, 'gpm' => 0.5, 'kp' => 3.0, 'vision' => 3.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 1.0, 'healing' => 2.0],
        'UTILITY_DAMAGE'    => ['kda' => 1.5, 'dpm' => 2.0, 'gpm' => 0.5, 'kp' => 3.0, 'vision' => 2.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 0.5, 'healing' => 2.0],
        'UTILITY_TANK'      => ['kda' => 1.5, 'dpm' => 0.5, 'gpm' => 0.5, 'kp' => 3.0, 'vision' => 2.5, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 3.0, 'healing' => 0.5],
    ];

    private const DEFAULT_INDIVIDUAL_W = ['kda' => 2.5, 'dpm' => 2.0, 'gpm' => 1.5, 'kp' => 2.0, 'vision' => 1.0, 'towerDmg' => 1.0, 'objDmg' => 1.0, 'tankPct' => 0.5, 'healing' => 0.5];
    private const DEFAULT_TEAM_W       = ['kda' => 2.0, 'dpm' => 1.5, 'gpm' => 1.0, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 1.0, 'objDmg' => 1.0, 'tankPct' => 0.5, 'healing' => 0.5];

    // Ölüm dengesi — lobi ortalama ölümünden sapma başına skor etkisi. Az ölen
    // ödüllenir, çok ölen (feed) cezalanır. op.gg'de ölüm baskın negatif; bu olmadan
    // vision/heal/KP'si yüksek feed support'lar (ör. 0/11/14 Soraka) fazla puan alıyor.
    private const DEATH_W = 0.4;

    // Galibiyet/mağlubiyet etkisi — kazanan +, kaybeden −. Referanslar sonucu tartar
    // ama performansı baskın tutar; o yüzden ölçülü (carry edilen zayıf kazananı
    // abartmasın). Bu olmadan hasarı yüksek kaybedenler (53k Ezreal) fazla puan alıyor.
    private const WIN_W = 0.8;

    /**
     * Tüm 10 oyuncunun ELW Score'unu hesapla — puuid → score map döner.
     * @param string $mode 'individual' veya 'team'
     */
    public function calculateAllElwScores(array $participants, int $duration, string $mode = 'individual'): array
    {
        $roleWeights = $mode === 'team' ? self::TEAM_WEIGHTS : self::INDIVIDUAL_WEIGHTS;
        $defaultW = $mode === 'team' ? self::DEFAULT_TEAM_W : self::DEFAULT_INDIVIDUAL_W;
        $minutes = max($duration / 60, 1);
        $avgDeaths = $this->avgDeaths($participants);

        $scores = [];
        foreach ($participants as $p) {
            $deaths = max($p['deaths'], 1);
            $c = $p['challenges'] ?? [];
            $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
            if ($role === 'BOT') $role = 'BOTTOM';

            // Support alt-tip: tank (çok hasar yer + az heal) / damage / enchanter
            if ($role === 'UTILITY') {
                $hs = ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0);
                $dmg = $p['totalDamageDealtToChampions'] ?? 0;
                $tankShare = $c['damageTakenOnTeamPercentage'] ?? 0;
                if ($tankShare >= 0.18 && $hs < $dmg) {
                    $role = 'UTILITY_TANK';          // Leona, Alistar, Nautilus, Thresh...
                } else {
                    $role = ($dmg > $hs) ? 'UTILITY_DAMAGE' : 'UTILITY_ENCHANTER';
                }
            }

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
            // Ölüm dengesi — az ölen ödüllenir, feed cezalanır (op.gg'ye yaklaşım)
            $score += ($avgDeaths - $p['deaths']) * self::DEATH_W;
            // Kitle kontrol (CC) — playmaker support/tank/orman ödülü (Zilean, Leona, Amumu...)
            $ccNorm = min((($p['timeCCingOthers'] ?? 0) / $minutes) / 1.5, 1);
            $ccW = str_starts_with($role, 'UTILITY') ? 1.6 : (in_array($role, ['TOP', 'JUNGLE']) ? 1.0 : 0.5);
            $score += $ccNorm * $ccW;
            // Galibiyet/mağlubiyet — sonuç ağırlığı (kazanan yukarı, kaybeden aşağı)
            $score += ($p['win'] ?? false) ? self::WIN_W : -self::WIN_W;

            $scores[] = ['puuid' => $p['puuid'], 'score' => $score];
        }

        // Bireysel mod: maç kartı başlığıyla (calculateMatchRanking → zToElw) AYNI
        // ölçekte olsun diye cömert eğri kullanılır (8.6 başlıkta = 8.6 tabloda).
        // Takım modu: takım-kalitesi sınıflandırması (great/good/avg/bad/terrible)
        // eşikleri lineer ölçeğe (5 = lobi ort.) ayarlı, o yüzden lineer kalır.
        return $mode === 'team'
            ? $this->normalizeScores($scores)
            : $this->normalizeScoresGenerous($scores);
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
        $avgDeaths = $this->avgDeaths($participants);

        $scores = [];
        foreach ($participants as $p) {
            $deaths = max($p['deaths'], 1);
            $c = $p['challenges'] ?? [];
            $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
            if ($role === 'BOT') $role = 'BOTTOM';

            // Support alt-tip: tank (çok hasar yer + az heal) / damage / enchanter
            if ($role === 'UTILITY') {
                $hs = ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0);
                $dmg = $p['totalDamageDealtToChampions'] ?? 0;
                $tankShare = $c['damageTakenOnTeamPercentage'] ?? 0;
                if ($tankShare >= 0.18 && $hs < $dmg) {
                    $role = 'UTILITY_TANK';          // Leona, Alistar, Nautilus, Thresh...
                } else {
                    $role = ($dmg > $hs) ? 'UTILITY_DAMAGE' : 'UTILITY_ENCHANTER';
                }
            }

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
            // Ölüm dengesi — az ölen ödüllenir, feed cezalanır (op.gg'ye yaklaşım)
            $score += ($avgDeaths - $p['deaths']) * self::DEATH_W;
            // Kitle kontrol (CC) — playmaker support/tank/orman ödülü (Zilean, Leona, Amumu...)
            $ccNorm = min((($p['timeCCingOthers'] ?? 0) / $minutes) / 1.5, 1);
            $ccW = str_starts_with($role, 'UTILITY') ? 1.6 : (in_array($role, ['TOP', 'JUNGLE']) ? 1.0 : 0.5);
            $score += $ccNorm * $ccW;
            // Galibiyet/mağlubiyet — sonuç ağırlığı (kazanan yukarı, kaybeden aşağı)
            $score += ($p['win'] ?? false) ? self::WIN_W : -self::WIN_W;

            $scores[] = ['puuid' => $p['puuid'], 'score' => $score];
        }

        // Z-score normalize
        $rawScores = array_column($scores, 'score');
        $avg = array_sum($rawScores) / max(count($rawScores), 1);
        $variance = 0;
        foreach ($rawScores as $rs) { $variance += ($rs - $avg) ** 2; }
        $stdDev = max(sqrt($variance / max(count($rawScores), 1)), 0.5);

        foreach ($scores as &$s) {
            $s['elwScore'] = $this->blendedElw($s['score'], $avg, $stdDev);
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

        $labels = \App\Models\AdminSetting::getValue('performance_labels', self::DEFAULT_LABELS);

        foreach ($labels as $l) {
            $c = $l['conditions'] ?? [];
            // win koşulu
            if (isset($c['win']) && $c['win'] !== null && (bool) $c['win'] !== $win) continue;
            // rank koşulları
            if (isset($c['rank_max']) && $rank > $c['rank_max']) continue;
            if (isset($c['rank_min']) && $rank < $c['rank_min']) continue;
            // KDA koşulu
            if (isset($c['kda_min']) && $kda < $c['kda_min']) continue;
            // Gold koşulları
            if (isset($c['earlyGold_max']) && ($earlyGoldLead === null || $earlyGoldLead >= $c['earlyGold_max'])) continue;
            if (isset($c['earlyGold_min']) && ($earlyGoldLead === null || $earlyGoldLead <= $c['earlyGold_min'])) continue;
            if (isset($c['lateGold_min']) && ($lateGoldLead === null || $lateGoldLead <= $c['lateGold_min'])) continue;
            if (isset($c['lateGold_max']) && ($lateGoldLead === null || $lateGoldLead >= $c['lateGold_max'])) continue;

            return ['label' => $l['label'], 'desc' => $l['desc'], 'color' => $l['color']];
        }

        return null;
    }

    /**
     * Z-score → 0-10 ELW skoru. Asimetrik eğri (kullanıcı tercihi): iyi tarafta cömert
     * (10'a doğru sature, ortalama z=0 → 5.4, MVP z≈2.5 → ~9.5), kötü tarafta lineer/düşük.
     */
    private function zToElw(float $z): float
    {
        $base = 5.4;
        $elw = $z >= 0
            ? $base + (10 - $base) * (1 - exp(-$z / 1.09))
            : $base + $z * 1.6;
        return round(max(0, min(10, $elw)), 1);
    }

    /**
     * Harman ELW — göreceli (lobi içi z-score) + mutlak (lobiden bağımsız ham skor).
     * Mutlak bileşen sayesinde iyi oynayan BİRDEN ÇOK oyuncu da ~10'a çıkabilir
     * (op.gg/dpm.lol gibi). Sadece göreceli olsaydı yalnız lobinin en iyisi yüksek alırdı.
     * Ham skor ~8.5 ve üzeri "mükemmel" kabul edilip 10'a eşlenir.
     */
    private function blendedElw(float $raw, float $avg, float $stdDev): float
    {
        $z = ($raw - $avg) / max($stdDev, 0.5);
        $rel = $this->zToElw($z);                      // göreceli
        $abs = max(0, min(10, $raw / 8.5 * 10));       // mutlak
        return round(0.5 * $rel + 0.5 * $abs, 1);
    }

    /**
     * Lobideki ortalama ölüm sayısı (10 oyuncu) — ölüm dengesi için referans.
     */
    private function avgDeaths(array $participants): float
    {
        $total = 0;
        foreach ($participants as $p) { $total += $p['deaths'] ?? 0; }
        return $total / max(count($participants), 1);
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

        // Takım skorları (teamQuality diff sınıflandırması) eski lineer ölçekte —
        // eşikler (great/good/avg/bad/terrible) bu ölçeğe göre ayarlı; 5 = lobi ortalaması.
        $result = [];
        foreach ($scores as $s) {
            $z = ($s['score'] - $avg) / $stdDev;
            $result[$s['puuid']] = round(max(0, min(10, 5 + $z * 1.8)), 1);
        }
        return $result;
    }

    /**
     * Cömert z-score normalizasyon (zToElw) — maç kartı başlığıyla aynı ölçek.
     * Skor tablosundaki bireysel puanlar bununla hesaplanır ki başlıktaki puanla
     * birebir tutsun (ör. başlıkta 8.6 → tabloda 8.6).
     */
    private function normalizeScoresGenerous(array $scores): array
    {
        $rawScores = array_column($scores, 'score');
        $avg = array_sum($rawScores) / max(count($rawScores), 1);
        $variance = 0;
        foreach ($rawScores as $rs) { $variance += ($rs - $avg) ** 2; }
        $stdDev = max(sqrt($variance / max(count($rawScores), 1)), 0.5);

        $result = [];
        foreach ($scores as $s) {
            $result[$s['puuid']] = $this->blendedElw($s['score'], $avg, $stdDev);
        }
        return $result;
    }

    private const DEFAULT_LABELS = [
        ['label' => 'Durdurulamaz', 'desc' => 'Eşsiz performans sergileyerek takımını zafere taşıdı.', 'color' => 'emerald',
         'conditions' => ['rank_max' => 2, 'win' => true, 'kda_min' => 4]],
        ['label' => 'Lider', 'desc' => 'İyi kararlar verip takımını zafere taşıdı.', 'color' => 'emerald',
         'conditions' => ['rank_max' => 3, 'win' => true]],
        ['label' => 'Geç Açılan', 'desc' => 'Zaman içinde giderek artan performans göstererek zafere ulaştı.', 'color' => 'blue',
         'conditions' => ['earlyGold_max' => -300, 'lateGold_min' => 500, 'win' => true]],
        ['label' => 'Erken Baskın', 'desc' => 'İyi bir başlangıç yaptı ama avantajı koruyamadı.', 'color' => 'yellow',
         'conditions' => ['earlyGold_min' => 500, 'lateGold_max' => -200, 'win' => false]],
        ['label' => 'Dirençli', 'desc' => 'Yenilgiye rağmen takımındaki en iyi performansı gösterdi.', 'color' => 'blue',
         'conditions' => ['rank_max' => 3, 'win' => false]],
        ['label' => 'Katkıcı', 'desc' => 'Takımına istikrarlı katkı sağlayarak galibiyete yardımcı oldu.', 'color' => 'gray',
         'conditions' => ['rank_min' => 4, 'rank_max' => 6, 'win' => true]],
        ['label' => 'Mücadele', 'desc' => 'Zor bir maç geçirdi.', 'color' => 'red',
         'conditions' => ['rank_min' => 8]],
        ['label' => 'Ortalama', 'desc' => 'Standart bir performans sergiledi.', 'color' => 'gray',
         'conditions' => ['rank_min' => 5, 'rank_max' => 7]],
    ];
}
