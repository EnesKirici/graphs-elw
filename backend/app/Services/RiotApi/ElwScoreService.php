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
    // ===== BİREYSEL PERFORMANS — her role kendine has görevler (kullanıcı onayı 2026-06-25) =====
    //                       kda  dpm  gpm  kp   vision tower  obj   tank  heal  ≈ 12.0 (denge: rol haksız avantaj almaz)
    private const INDIVIDUAL_WEIGHTS = [
        'TOP'     => ['kda' => 2.5, 'dpm' => 2.0, 'gpm' => 1.5, 'kp' => 1.5, 'vision' => 1.0, 'towerDmg' => 2.0, 'objDmg' => 0.5, 'tankPct' => 1.0, 'healing' => 0.0],
        'JUNGLE'  => ['kda' => 2.5, 'dpm' => 1.5, 'gpm' => 1.0, 'kp' => 2.0, 'vision' => 2.0, 'towerDmg' => 0.0, 'objDmg' => 2.5, 'tankPct' => 0.5, 'healing' => 0.0], // ejder/baron + gank + vizyon
        'MIDDLE'  => ['kda' => 2.5, 'dpm' => 2.5, 'gpm' => 2.0, 'kp' => 2.0, 'vision' => 1.0, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        'BOTTOM'  => ['kda' => 2.5, 'dpm' => 3.0, 'gpm' => 2.0, 'kp' => 2.0, 'vision' => 0.5, 'towerDmg' => 1.5, 'objDmg' => 0.5, 'tankPct' => 0.0, 'healing' => 0.0],
        // Enchanter support (Lulu, Janna, Soraka...) — heal/shield ve vision ön planda
        'UTILITY_ENCHANTER' => ['kda' => 2.5, 'dpm' => 0.5, 'gpm' => 0.5, 'kp' => 2.0, 'vision' => 2.5, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 1.0, 'healing' => 2.0],
        // Hasar support (Brand, Zyra, Vel'Koz...) — hasar ve KP ön planda
        'UTILITY_DAMAGE'    => ['kda' => 2.0, 'dpm' => 2.0, 'gpm' => 0.5, 'kp' => 2.5, 'vision' => 2.0, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 0.5, 'healing' => 2.0],
        // Tank support (Leona, Alistar, Nautilus...) — tank katkısı (önde durma) + vizyon
        'UTILITY_TANK'      => ['kda' => 2.0, 'dpm' => 1.0, 'gpm' => 0.5, 'kp' => 2.5, 'vision' => 2.5, 'towerDmg' => 0.0, 'objDmg' => 0.5, 'tankPct' => 2.0, 'healing' => 0.5],
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

    // Rol etiketleri (şeffaflık modalı için).
    private const ROLE_LABELS = [
        'TOP' => 'Top', 'JUNGLE' => 'Orman', 'MIDDLE' => 'Orta', 'BOTTOM' => 'ADC',
        'UTILITY_ENCHANTER' => 'Destek (Şifa)', 'UTILITY_DAMAGE' => 'Destek (Hasar)', 'UTILITY_TANK' => 'Destek (Tank)',
    ];

    // Ölüm dengesi — lobi ortalama ölümünden sapma başına skor etkisi. Az ölen
    // ödüllenir, çok ölen (feed) cezalanır. op.gg'de ölüm baskın negatif; bu olmadan
    // vision/heal/KP'si yüksek feed support'lar (ör. 0/11/14 Soraka) fazla puan alıyor.
    private const DEATH_W = 0.4;

    // CC (kontrol) bonusu — TÜM rollere EŞİT, bonus-only (atmayan cezalanmaz, 0 alır).
    // Atılan CC süresine göre puanlanır → çok CC atan (engage/peel: Leona/Amumu) doğal
    // olarak çok alır; CC'siz carry (ADC) 0 alır ama puanını dmg'den toplar.
    private const CC_W = 1.0;

    // Galibiyet/mağlubiyet bonusu KALDIRILDI (kullanıcı kararı 2026-06-25): "sonuca değil,
    // ne yaptığına göre puan." Kazandıran aksiyonlar (objektif/kule/KP/hasar) zaten
    // puanlandığı için win doğal yansır; düz bonus carry edilen kazananı haksız şişiriyordu.

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
            $role = $this->resolveRole($p);
            $w = $roleWeights[$role] ?? $defaultW;
            $comp = $this->scoreComponents($p, $w, $minutes, $avgDeaths, $role);
            $scores[] = ['puuid' => $p['puuid'], 'score' => $comp['raw']];
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
            $role = $this->resolveRole($p);
            $w = $roleWeights[$role] ?? $defaultW;
            $comp = $this->scoreComponents($p, $w, $minutes, $avgDeaths, $role);
            $scores[] = ['puuid' => $p['puuid'], 'score' => $comp['raw']];
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
     * Tek oyuncunun ELW skor KIRILIMI — DPM-tarzı şeffaflık modalı için.
     * Final skor (maç kartıyla aynı ölçek: blendedElw) + harf notu + role + bileşen listesi
     * (her bileşen: stat → puan). Oyuncu lobide yoksa null.
     */
    public function scoreBreakdown(array $participants, string $puuid, int $duration, string $mode = 'individual'): ?array
    {
        $roleWeights = $mode === 'team' ? self::TEAM_WEIGHTS : self::INDIVIDUAL_WEIGHTS;
        $defaultW = $mode === 'team' ? self::DEFAULT_TEAM_W : self::DEFAULT_INDIVIDUAL_W;
        $minutes = max($duration / 60, 1);
        $avgDeaths = $this->avgDeaths($participants);

        $raws = [];
        $mine = null;
        foreach ($participants as $p) {
            $role = $this->resolveRole($p);
            $w = $roleWeights[$role] ?? $defaultW;
            $comp = $this->scoreComponents($p, $w, $minutes, $avgDeaths, $role);
            $raws[] = $comp['raw'];
            if ($p['puuid'] === $puuid) {
                $mine = ['role' => $role, 'comp' => $comp];
            }
        }
        if ($mine === null) return null;

        $avg = array_sum($raws) / max(count($raws), 1);
        $variance = 0;
        foreach ($raws as $r) { $variance += ($r - $avg) ** 2; }
        $stdDev = max(sqrt($variance / max(count($raws), 1)), 0.5);
        $score = $this->blendedElw($mine['comp']['raw'], $avg, $stdDev);

        return [
            'score'      => $score,
            'grade'      => $this->scoreGrade($score),
            'role'       => $mine['role'],
            'roleLabel'  => self::ROLE_LABELS[$mine['role']] ?? $mine['role'],
            'components' => array_map(fn ($c) => [
                'key'    => $c['key'],
                'label'  => $c['label'],
                'stat'   => $c['stat'],
                'weight' => round($c['weight'], 1),
                'points' => round($c['points'], 1),
            ], $mine['comp']['components']),
        ];
    }

    /** ELW skoru → harf notu (DPM-tarzı). */
    private function scoreGrade(float $s): string
    {
        return match (true) {
            $s >= 9.0 => 'S+',
            $s >= 8.0 => 'S',
            $s >= 7.0 => 'A',
            $s >= 5.5 => 'B',
            $s >= 4.0 => 'C',
            default   => 'D',
        };
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
     * Oyuncunun rolünü çöz (BOT→BOTTOM; UTILITY→tank/damage/enchanter alt-tip).
     */
    private function resolveRole(array $p): string
    {
        $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
        if ($role === 'BOT') $role = 'BOTTOM';
        if ($role === 'UTILITY') {
            $c = $p['challenges'] ?? [];
            $hs = ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0);
            $dmg = $p['totalDamageDealtToChampions'] ?? 0;
            $tankShare = $c['damageTakenOnTeamPercentage'] ?? 0;
            if ($tankShare >= 0.18 && $hs < $dmg) {
                $role = 'UTILITY_TANK';          // Leona, Alistar, Nautilus, Thresh...
            } else {
                $role = ($dmg > $hs) ? 'UTILITY_DAMAGE' : 'UTILITY_ENCHANTER';
            }
        }
        return $role;
    }

    /**
     * Tek oyuncunun ELW ham skor BİLEŞENLERİ — şeffaflık modalı + ham skor kaynağı.
     * Her bileşen: key, label, stat (gösterim), weight (role-bazlı ağırlık), points (katkı).
     * Toplam 'raw' = eski satır-içi skorla BİREBİR aynı (regresyon yok).
     */
    private function scoreComponents(array $p, array $w, float $minutes, float $avgDeaths, string $role): array
    {
        $c = $p['challenges'] ?? [];
        $deaths = max($p['deaths'], 1);
        $kda = ($p['kills'] + $p['assists']) / $deaths;
        $dpm = $c['damagePerMinute'] ?? 0;
        $gpm = $c['goldPerMinute'] ?? 0;
        $kp = $c['killParticipation'] ?? 0;
        $vsPerMin = $c['visionScorePerMinute'] ?? 0;
        $tower = $p['damageDealtToTurrets'] ?? 0;
        $obj = $p['damageDealtToObjectives'] ?? 0;
        $tankPct = $c['damageTakenOnTeamPercentage'] ?? 0;
        $healShield = ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0);
        $ccSec = $p['timeCCingOthers'] ?? 0;
        $ccW = self::CC_W; // eşit bonus — atan kazanır, atmayan 0 alır (ceza yok)

        $components = [
            ['key' => 'kda',      'label' => 'KDA',               'stat' => number_format($kda, 2),                        'weight' => $w['kda'],      'points' => min(log($kda + 1) / log(10), 1) * $w['kda']],
            ['key' => 'dpm',      'label' => 'Hasar / dk',        'stat' => number_format(round($dpm)),                    'weight' => $w['dpm'],      'points' => min($dpm / 1500, 1) * $w['dpm']],
            ['key' => 'gpm',      'label' => 'Altın / dk',        'stat' => number_format(round($gpm)),                    'weight' => $w['gpm'],      'points' => min($gpm / 700, 1) * $w['gpm']],
            ['key' => 'kp',       'label' => 'Kill Katılımı',     'stat' => round($kp * 100) . '%',                        'weight' => $w['kp'],       'points' => $kp * $w['kp']],
            ['key' => 'vision',   'label' => 'Görüş / dk',        'stat' => number_format($vsPerMin, 1),                   'weight' => $w['vision'],   'points' => min($vsPerMin / 3.0, 1) * $w['vision']],
            ['key' => 'towerDmg', 'label' => 'Kule Hasarı',       'stat' => number_format(round($tower)),                  'weight' => $w['towerDmg'], 'points' => min($tower / 10000, 1) * $w['towerDmg']],
            ['key' => 'objDmg',   'label' => 'Objektif Hasarı',   'stat' => number_format(round($obj)),                    'weight' => $w['objDmg'],   'points' => min($obj / 30000, 1) * $w['objDmg']],
            ['key' => 'tankPct',  'label' => 'Tank Katkısı',      'stat' => round($tankPct * 100) . '%',                   'weight' => $w['tankPct'],  'points' => $tankPct * $w['tankPct']],
            ['key' => 'healing',  'label' => 'İyileştirme/Kalkan', 'stat' => number_format(round($healShield)),            'weight' => $w['healing'],  'points' => min($healShield / $minutes / 800, 1) * $w['healing']],
            ['key' => 'death',    'label' => 'Ölüm Dengesi',      'stat' => $p['deaths'] . ' (ort ' . number_format($avgDeaths, 1) . ')', 'weight' => self::DEATH_W, 'points' => ($avgDeaths - $p['deaths']) * self::DEATH_W],
            ['key' => 'cc',       'label' => 'CC (Kontrol)',      'stat' => round($ccSec) . ' sn',                         'weight' => $ccW,           'points' => min(($ccSec / $minutes) / 1.5, 1) * $ccW],
            // Galibiyet/Mağlubiyet bonusu KALDIRILDI — "sonuca değil, ne yaptığına" göre puan.
            // Kazandıran aksiyonlar (objektif/kule/KP/hasar) zaten puanlandığı için win doğal yansır.
        ];

        $raw = 0.0;
        foreach ($components as $cmp) { $raw += $cmp['points']; }
        return ['components' => $components, 'raw' => $raw];
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
