<?php

namespace App\Services\RiotApi;

/**
 * ELW Score Algoritması — 10 üzerinden performans puanı (DPM-tarzı kategorili).
 *
 * Skor = tüm metriklerin puanları toplamı (norm 0–1 × role-bazlı ağırlık), lobi içi
 * z-score ile 0–10'a ölçeklenir. Metrikler 5 KATEGORİDE gruplanır (modal sekmeleri +
 * her kategoriye harf notu): Global · vs Rakip · Objektif · Takım · Role-özel.
 *
 * Her metriğin role göre ağırlığı ROLE_W'den gelir → ormancı objektif/ganktan, ADC
 * hasar/koridordan, destek vizyon/heal'den puan toplar. Galibiyet/mağlubiyet puana
 * GİRMEZ ("sonuca değil ne yaptığına"); kazandıran aksiyonlar zaten puanlı.
 */
class ElwScoreService
{
    private const CATEGORIES = ['global', 'vsOpp', 'objective', 'team', 'role'];

    private const CAT_LABELS = [
        'global'    => 'Global',
        'vsOpp'     => 'vs Rakip',
        'objective' => 'Objektif',
        'team'      => 'Takım',
        'role'      => 'Role-Özel',
    ];

    // Her metriğin kategorisi + etiketi (modal gösterimi).
    private const METRIC_META = [
        // Global
        'kills'      => ['cat' => 'global', 'label' => 'Kill'],
        'deaths'     => ['cat' => 'global', 'label' => 'Ölüm'],
        'assists'    => ['cat' => 'global', 'label' => 'Asist'],
        'cs'         => ['cat' => 'global', 'label' => 'CS / dk'],
        'gold'       => ['cat' => 'global', 'label' => 'Altın / dk'],
        'dmg'        => ['cat' => 'global', 'label' => 'Hasar / dk'],
        'vision'     => ['cat' => 'global', 'label' => 'Vizyon / dk'],
        'firstBlood' => ['cat' => 'global', 'label' => 'İlk Kan'],
        'multikill'  => ['cat' => 'global', 'label' => 'Multikill'],
        // vs Rakip (koridor rakibiyle fark — işaretli)
        'goldDiff'   => ['cat' => 'vsOpp', 'label' => 'Altın farkı'],
        'csDiff'     => ['cat' => 'vsOpp', 'label' => 'CS farkı'],
        'xpDiff'     => ['cat' => 'vsOpp', 'label' => 'XP farkı'],
        // Objektif
        'dragon'     => ['cat' => 'objective', 'label' => 'Ejder'],
        'baron'      => ['cat' => 'objective', 'label' => 'Baron'],
        'herald'     => ['cat' => 'objective', 'label' => 'Herald'],
        'objDmg'     => ['cat' => 'objective', 'label' => 'Obj. Hasarı'],
        'steal'      => ['cat' => 'objective', 'label' => 'Epic Çalma'],
        // Takım
        'kp'         => ['cat' => 'team', 'label' => 'Kill Katılımı'],
        'teamDmg'    => ['cat' => 'team', 'label' => 'Hasar Payı'],
        'tank'       => ['cat' => 'team', 'label' => 'Alınan Hasar Payı'],
        // Role-özel
        'turretPlate' => ['cat' => 'role', 'label' => 'Kule Plakası'],
        'soloKills'   => ['cat' => 'role', 'label' => 'Solo Kill'],
        'csAt10'      => ['cat' => 'role', 'label' => 'CS @10'],
        'towerDmg'    => ['cat' => 'role', 'label' => 'Kule Hasarı'],
        'wards'       => ['cat' => 'role', 'label' => 'Ward'],
        'controlWard' => ['cat' => 'role', 'label' => 'Kontrol Ward'],
        'heal'        => ['cat' => 'role', 'label' => 'Heal / Kalkan'],
        'cc'          => ['cat' => 'role', 'label' => 'CC (Kontrol)'],
        // ELW #7 (2026-06-30) — yeni granül metrikler (destek + genel; DPM-uyumlu)
        'wardsKilled' => ['cat' => 'role',      'label' => 'Ward Temizleme'],   // wardTakedowns
        'pickKill'    => ['cat' => 'team',      'label' => 'Koordineli Kill'],  // pickKillWithAlly
        'saveAlly'    => ['cat' => 'role',      'label' => 'Clutch Kurtarma'],  // saveAllyFromDeath
        'visionAdv'   => ['cat' => 'vsOpp',     'label' => 'Vizyon Farkı'],     // visionScoreAdvantageLaneOpponent
        'grubs'       => ['cat' => 'objective', 'label' => 'Grub'],             // voidMonsterKill
        'turretTd'    => ['cat' => 'objective', 'label' => 'Kule Katkısı'],     // turretTakedowns
        'diveKill'    => ['cat' => 'role',      'label' => 'Kule Dalış Kill'],  // killsNearEnemyTurret
        'counterJg'   => ['cat' => 'objective', 'label' => 'Counter-Jungle'],   // enemyJungleMonsterKills
        'earlyGank'   => ['cat' => 'team',      'label' => 'Erken Gank'],       // killsOnLanersEarlyJungleAsJungler
        'roamKill'    => ['cat' => 'team',      'label' => 'Roam Kill'],        // killsOnOtherLanesEarlyJungleAsLaner
        'earlyLead'   => ['cat' => 'vsOpp',     'label' => 'Erken Üstünlük'],   // earlyLaningPhaseGoldExpAdvantage
    ];

    // ===== ROLE AĞIRLIKLARI — her role hangi metrik ne kadar (puan = norm × ağırlık) =====
    // 'deaths' ağırlığı NEGATİF (ceza). vs-Rakip işaretli (-1..1). v1 — örnek maçlarla ayarlanacak.
    private const ROLE_W = [
        'TOP' => [
            'kills' => 1.0, 'deaths' => -1.5, 'assists' => 0.7, 'cs' => 1.0, 'gold' => 1.0, 'dmg' => 1.5, 'vision' => 0.5, 'firstBlood' => 0.5,
            'goldDiff' => 0.9, 'csDiff' => 0.6, 'xpDiff' => 0.6,
            'dragon' => 0.3, 'baron' => 0.5, 'herald' => 0.5, 'objDmg' => 0.3, 'steal' => 0.5,
            'kp' => 1.8, 'teamDmg' => 1.2, 'tank' => 1.0,
            'turretPlate' => 0.7, 'soloKills' => 0.8, 'csAt10' => 0.7, 'towerDmg' => 0.7, 'cc' => 0.7,
            'visionAdv' => 0.3, 'grubs' => 0.3, 'turretTd' => 0.4, 'diveKill' => 0.3, 'pickKill' => 0.3, 'roamKill' => 0.3, 'earlyLead' => 0.5, 'wardsKilled' => 0.2,
        ],
        'JUNGLE' => [
            'kills' => 1.0, 'deaths' => -1.5, 'assists' => 0.8, 'cs' => 0.8, 'gold' => 0.8, 'dmg' => 1.0, 'vision' => 1.0, 'firstBlood' => 0.5,
            'goldDiff' => 0.5, 'csDiff' => 0.3, 'xpDiff' => 0.3,
            'dragon' => 1.5, 'baron' => 1.2, 'herald' => 1.2, 'objDmg' => 1.5, 'steal' => 1.0,
            'kp' => 2.2, 'teamDmg' => 1.0, 'tank' => 0.8,
            'soloKills' => 0.8, 'csAt10' => 0.5, 'wards' => 0.5, 'controlWard' => 0.5, 'cc' => 1.0,
            'grubs' => 0.8, 'counterJg' => 0.6, 'earlyGank' => 0.8, 'pickKill' => 0.6, 'wardsKilled' => 0.4, 'visionAdv' => 0.3, 'diveKill' => 0.3, 'turretTd' => 0.3,
        ],
        'MIDDLE' => [
            'kills' => 1.2, 'deaths' => -1.5, 'assists' => 0.8, 'cs' => 1.1, 'gold' => 1.1, 'dmg' => 1.8, 'vision' => 0.6, 'firstBlood' => 0.5,
            'goldDiff' => 0.9, 'csDiff' => 0.6, 'xpDiff' => 0.6,
            'dragon' => 0.3, 'baron' => 0.5, 'herald' => 0.3, 'objDmg' => 0.3, 'steal' => 0.5,
            'kp' => 1.7, 'teamDmg' => 1.4, 'tank' => 0.0,
            'turretPlate' => 0.7, 'soloKills' => 0.8, 'csAt10' => 0.7, 'towerDmg' => 0.7, 'cc' => 0.5,
            'roamKill' => 0.5, 'grubs' => 0.3, 'visionAdv' => 0.3, 'diveKill' => 0.3, 'turretTd' => 0.3, 'pickKill' => 0.4, 'earlyLead' => 0.5, 'wardsKilled' => 0.2,
        ],
        'BOTTOM' => [
            'kills' => 1.2, 'deaths' => -1.5, 'assists' => 0.7, 'cs' => 1.3, 'gold' => 1.2, 'dmg' => 2.0, 'vision' => 0.4, 'firstBlood' => 0.4,
            'goldDiff' => 0.9, 'csDiff' => 0.7, 'xpDiff' => 0.5,
            'dragon' => 0.4, 'baron' => 0.5, 'herald' => 0.3, 'objDmg' => 0.4, 'steal' => 0.4,
            'kp' => 1.8, 'teamDmg' => 1.6, 'tank' => 0.0,
            'turretPlate' => 0.5, 'soloKills' => 0.5, 'csAt10' => 0.9, 'towerDmg' => 0.9, 'cc' => 0.3,
            'visionAdv' => 0.3, 'grubs' => 0.3, 'turretTd' => 0.4, 'diveKill' => 0.3, 'pickKill' => 0.4, 'roamKill' => 0.2, 'earlyLead' => 0.5, 'wardsKilled' => 0.2,
        ],
        'UTILITY_ENCHANTER' => [
            'kills' => 0.5, 'deaths' => -1.2, 'assists' => 1.5, 'cs' => 0.3, 'gold' => 0.3, 'dmg' => 0.5, 'vision' => 1.6, 'firstBlood' => 0.3,
            'goldDiff' => 0.3, 'csDiff' => 0.0, 'xpDiff' => 0.0,
            'dragon' => 0.3, 'baron' => 0.3, 'herald' => 0.3, 'objDmg' => 0.2, 'steal' => 0.3,
            'kp' => 2.7, 'teamDmg' => 0.5, 'tank' => 0.8,
            'wards' => 1.6, 'controlWard' => 1.3, 'heal' => 2.2, 'cc' => 1.1,
            'wardsKilled' => 0.7, 'pickKill' => 0.6, 'saveAlly' => 0.9, 'visionAdv' => 0.6, 'turretTd' => 0.2, 'grubs' => 0.2,
        ],
        'UTILITY_DAMAGE' => [
            'kills' => 0.7, 'deaths' => -1.2, 'assists' => 1.4, 'cs' => 0.3, 'gold' => 0.3, 'dmg' => 1.3, 'vision' => 1.4, 'firstBlood' => 0.3,
            'goldDiff' => 0.3, 'csDiff' => 0.0, 'xpDiff' => 0.0,
            'dragon' => 0.3, 'baron' => 0.3, 'herald' => 0.3, 'objDmg' => 0.2, 'steal' => 0.3,
            'kp' => 2.7, 'teamDmg' => 1.2, 'tank' => 0.5,
            'wards' => 1.3, 'controlWard' => 1.1, 'heal' => 0.8, 'cc' => 1.1,
            'wardsKilled' => 0.7, 'pickKill' => 0.6, 'saveAlly' => 0.5, 'visionAdv' => 0.6, 'diveKill' => 0.2, 'turretTd' => 0.2, 'grubs' => 0.2,
        ],
        'UTILITY_TANK' => [
            'kills' => 0.5, 'deaths' => -1.0, 'assists' => 1.5, 'cs' => 0.3, 'gold' => 0.3, 'dmg' => 0.6, 'vision' => 1.4, 'firstBlood' => 0.3,
            'goldDiff' => 0.3, 'csDiff' => 0.0, 'xpDiff' => 0.0,
            'dragon' => 0.3, 'baron' => 0.3, 'herald' => 0.3, 'objDmg' => 0.2, 'steal' => 0.3,
            'kp' => 2.7, 'teamDmg' => 0.5, 'tank' => 1.4,
            'wards' => 1.4, 'controlWard' => 1.1, 'heal' => 0.5, 'cc' => 1.4,
            'wardsKilled' => 0.6, 'pickKill' => 0.6, 'saveAlly' => 0.5, 'visionAdv' => 0.5, 'diveKill' => 0.2, 'turretTd' => 0.2, 'grubs' => 0.2,
        ],
    ];

    // ===== ROLE BASELINE — her rolün ortalama ham skoru (400 maç ölçümü) =====
    // Skor, oyuncunun ham skorunu KENDİ ROLÜNÜN ortalamasına bölerek normalize edilir →
    // ROLE-RELATİF: "mükemmel destek" = "mükemmel ADC" (DPM gibi). ADC çok ham biriktirdiği
    // için baseline'ı yüksek; bölünce dengelenir. ROLE_W değişirse yeniden ölçülmeli.
    // 2026-06-30: #7 granül metrikler eklendikten SONRA 156 taze maçla yeniden ölçüldü
    // (elw:calibrate-baselines mantığı, tam-veri). Destek/orman yeni metriklerden çok kazandı.
    private const ROLE_BASELINE = [
        'TOP' => 8.43, 'JUNGLE' => 10.28, 'MIDDLE' => 8.69, 'BOTTOM' => 9.19,
        'UTILITY_ENCHANTER' => 10.64, 'UTILITY_DAMAGE' => 9.3, 'UTILITY_TANK' => 9.56,
    ];

    // Tüm rollere EŞİT uygulanan metrikler (role-bağımsız bonuslar) — ROLE_W ile birleştirilir.
    private const UNIVERSAL_W = [
        'multikill' => 0.8, // triple/quadra/penta küçük + (kullanıcı isteği — taşıyan oyuncu ödüllensin)
    ];

    // Rol etiketleri (şeffaflık modalı için).
    private const ROLE_LABELS = [
        'TOP' => 'Top', 'JUNGLE' => 'Orman', 'MIDDLE' => 'Orta', 'BOTTOM' => 'ADC',
        'UTILITY_ENCHANTER' => 'Destek (Şifa)', 'UTILITY_DAMAGE' => 'Destek (Hasar)', 'UTILITY_TANK' => 'Destek (Tank)',
    ];

    // Hibrit baseline (role-relatif ↔ ham etki) — config/elwgraphs.php#elw_score. Bkz. roleAdjusted.
    private readonly float $baselineBlend;
    private readonly float $globalBaseline;

    public function __construct()
    {
        // config konteyneri yoksa (saf unit test) varsayılana düş → servis framework'süz de çalışır.
        $blend = 0.5;
        $global = 7.72;
        try {
            $blend  = (float) config('elwgraphs.elw_score.baseline_blend', 0.5);
            $global = (float) config('elwgraphs.elw_score.global_baseline', 7.72);
        } catch (\Throwable $e) {
            // varsayılan kalır
        }
        $this->baselineBlend  = $blend;
        $this->globalBaseline = $global;
    }

    /**
     * Tüm 10 oyuncunun ELW Score'unu hesapla — puuid → score map döner.
     * @param string $mode 'individual' (cömert eğri — maç kartı) veya 'team' (lineer — takım kalitesi)
     */
    public function calculateAllElwScores(array $participants, int $duration, string $mode = 'individual'): array
    {
        $ctx = $this->buildContext($participants, $duration);

        $scores = [];
        foreach ($participants as $p) {
            $role = $this->resolveRole($p);
            $cs = $this->categorizedScore($p, $role, $ctx);
            $scores[] = ['puuid' => $p['puuid'], 'score' => $this->roleAdjusted($cs['raw'], $role)];
        }

        return $mode === 'team'
            ? $this->normalizeScores($scores)
            : $this->normalizeScoresGenerous($scores);
    }

    /**
     * KALİBRASYON yardımcısı — her katılımcının rolü + ham (baseline öncesi) skoru.
     * calculateAllElwScores ile AYNI bağlamı kullanır (timeline yok → xpDiff yok),
     * böylece maç-kartı skoruyla tutarlı baseline ölçülür. ROLE_BASELINE'ı bu çıktının
     * role-göre ortalamasından yeniden hesaplamak için `elw:calibrate-baselines` kullanır.
     * @return array<int, array{role:string, raw:float}>
     */
    public function participantRawScores(array $participants, int $duration): array
    {
        $ctx = $this->buildContext($participants, $duration);
        $out = [];
        foreach ($participants as $p) {
            $role = $this->resolveRole($p);
            $out[] = ['role' => $role, 'raw' => $this->categorizedScore($p, $role, $ctx)['raw']];
        }
        return $out;
    }

    /**
     * Tek oyuncu için ELW Score + lobi sıralaması (maç kartı başlığı).
     */
    public function calculateMatchRanking(array $participants, string $puuid, int $duration = 0): array
    {
        $ctx = $this->buildContext($participants, $duration);

        $scores = [];
        foreach ($participants as $p) {
            $role = $this->resolveRole($p);
            $cs = $this->categorizedScore($p, $role, $ctx);
            $scores[] = ['puuid' => $p['puuid'], 'score' => $this->roleAdjusted($cs['raw'], $role)];
        }

        [$avg, $stdDev] = $this->lobbyStats($scores);
        foreach ($scores as &$s) {
            $s['elwScore'] = $this->blendedElw($s['score'], $avg, $stdDev);
        }
        unset($s);

        usort($scores, fn ($a, $b) => $b['score'] <=> $a['score']);

        $rank = 1;
        $myScore = 0;
        foreach ($scores as $i => $s) {
            if ($s['puuid'] === $puuid) {
                $rank = $i + 1;
                $myScore = $s['elwScore'];
                break;
            }
        }

        return ['rank' => $rank, 'elwScore' => $myScore];
    }

    /**
     * Tek oyuncunun ELW skor KIRILIMI — DPM-tarzı kategorili modal için.
     * Final skor (maç kartıyla aynı: blendedElw) + harf notu + role + KATEGORİLER
     * (her kategori: harf notu + metrikler [stat → puan]). Oyuncu lobide yoksa null.
     *
     * @param ?array $timeline XP farkı için (varsa); yoksa o satır atlanır.
     */
    public function scoreBreakdown(array $participants, string $puuid, int $duration, string $mode = 'individual', ?array $timeline = null): ?array
    {
        $ctx = $this->buildContext($participants, $duration, $timeline);

        $raws = [];
        $mine = null;
        foreach ($participants as $p) {
            $role = $this->resolveRole($p);
            $cs = $this->categorizedScore($p, $role, $ctx);
            $adj = $this->roleAdjusted($cs['raw'], $role);
            $raws[] = $adj;
            if ($p['puuid'] === $puuid) {
                $mine = ['role' => $role, 'cs' => $cs, 'adj' => $adj];
            }
        }
        if ($mine === null) {
            return null;
        }

        [$avg, $stdDev] = $this->lobbyStats($raws, true);
        $score = $this->blendedElw($mine['adj'], $avg, $stdDev);

        return [
            'score'      => $score,
            'grade'      => $this->scoreGrade($score),
            'role'       => $mine['role'],
            'roleLabel'  => self::ROLE_LABELS[$mine['role']] ?? $mine['role'],
            'categories' => $this->formatCategories($mine['cs']['categories'], $mine['role']),
        ];
    }

    // ────────────────────────────────────────────
    //  Çekirdek — metrikler + kategorili puanlama
    // ────────────────────────────────────────────

    /**
     * Lobi bağlamı: dakika, koridor-rakip haritası (puuid → rakip), XP haritası (timeline'dan).
     */
    private function buildContext(array $participants, int $duration, ?array $timeline = null): array
    {
        return [
            'minutes' => max($duration / 60, 1),
            'oppMap'  => $this->buildOpponentMap($participants),
            'xpMap'   => $this->buildXpMap($participants, $timeline),
        ];
    }

    /**
     * Tek oyuncunun kategorili ham skoru: ['raw' => float, 'categories' => [cat => [metrics]]].
     */
    private function categorizedScore(array $p, string $role, array $ctx): array
    {
        $metrics = $this->playerMetrics($p, $ctx);
        $weights = array_merge(self::UNIVERSAL_W, self::ROLE_W[$role] ?? self::ROLE_W['MIDDLE']);

        $categories = array_fill_keys(self::CATEGORIES, []);
        $raw = 0.0;
        foreach ($metrics as $key => $m) {
            $w = $weights[$key] ?? 0.0;
            if ($w === 0.0) {
                continue; // bu role bu metrik önemsiz → gösterme
            }
            $points = $m['norm'] * $w;
            $raw += $points;
            $cat = self::METRIC_META[$key]['cat'];
            $categories[$cat][] = [
                'key'    => $key,
                'label'  => self::METRIC_META[$key]['label'],
                'stat'   => $m['stat'],
                'weight' => $w,
                'points' => $points,
            ];
        }

        return ['raw' => $raw, 'categories' => $categories];
    }

    /**
     * Tek oyuncunun ham metrikleri: key => ['stat' => gösterim, 'norm' => 0..1 (vs-Rakip -1..1)].
     */
    private function playerMetrics(array $p, array $ctx): array
    {
        $c = $p['challenges'] ?? [];
        $minutes = $ctx['minutes'];
        $cs = ($p['totalMinionsKilled'] ?? 0) + ($p['neutralMinionsKilled'] ?? 0);
        $csPerMin = $cs / $minutes;
        $dpm = $c['damagePerMinute'] ?? 0;
        $gpm = $c['goldPerMinute'] ?? 0;
        $vsPerMin = $c['visionScorePerMinute'] ?? 0;
        $heal = ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0);
        $cc = $p['timeCCingOthers'] ?? 0;
        $dbl = $p['doubleKills'] ?? 0; $trp = $p['tripleKills'] ?? 0; $qd = $p['quadraKills'] ?? 0; $pt = $p['pentaKills'] ?? 0;
        $mkScore = $pt * 2.0 + $qd * 1.2 + $trp * 0.6 + $dbl * 0.2; // penta>quadra>triple>double
        $mkLabel = $pt > 0 ? 'Penta' : ($qd > 0 ? 'Quadra' : ($trp > 0 ? 'Triple' : ($dbl > 0 ? "Double×$dbl" : '—')));

        $m = [
            'kills'      => ['stat' => (string) ($p['kills'] ?? 0),   'norm' => min(($p['kills'] ?? 0) / 10, 1)],
            'deaths'     => ['stat' => (string) ($p['deaths'] ?? 0),  'norm' => min(($p['deaths'] ?? 0) / 10, 1)],
            'assists'    => ['stat' => (string) ($p['assists'] ?? 0), 'norm' => min(($p['assists'] ?? 0) / 15, 1)],
            'cs'         => ['stat' => number_format($csPerMin, 1),   'norm' => min($csPerMin / 9, 1)],
            'gold'       => ['stat' => number_format(round($gpm)),    'norm' => min($gpm / 500, 1)],
            'dmg'        => ['stat' => number_format(round($dpm)),    'norm' => min($dpm / 1000, 1)],
            'vision'     => ['stat' => number_format($vsPerMin, 1),   'norm' => min($vsPerMin / 2.5, 1)],
            'firstBlood' => ['stat' => ($c['firstBloodKill'] ?? false) ? 'Evet' : 'Hayır', 'norm' => ($c['firstBloodKill'] ?? false) ? 1 : 0],
            'multikill'  => ['stat' => $mkLabel, 'norm' => min($mkScore / 1.5, 1)],

            'dragon'  => ['stat' => (string) ($c['dragonTakedowns'] ?? 0),     'norm' => min(($c['dragonTakedowns'] ?? 0) / 4, 1)],
            'baron'   => ['stat' => (string) ($c['baronTakedowns'] ?? 0),      'norm' => min(($c['baronTakedowns'] ?? 0) / 2, 1)],
            'herald'  => ['stat' => (string) ($c['riftHeraldTakedowns'] ?? 0), 'norm' => min(($c['riftHeraldTakedowns'] ?? 0) / 2, 1)],
            'objDmg'  => ['stat' => number_format($p['damageDealtToObjectives'] ?? 0), 'norm' => min(($p['damageDealtToObjectives'] ?? 0) / 25000, 1)],
            'steal'   => ['stat' => (string) ($c['epicMonsterSteals'] ?? 0),   'norm' => min(($c['epicMonsterSteals'] ?? 0) / 1, 1)],

            'kp'      => ['stat' => round(($c['killParticipation'] ?? 0) * 100) . '%',          'norm' => min($c['killParticipation'] ?? 0, 1)],
            'teamDmg' => ['stat' => round(($c['teamDamagePercentage'] ?? 0) * 100) . '%',        'norm' => min(($c['teamDamagePercentage'] ?? 0) / 0.35, 1)],
            'tank'    => ['stat' => round(($c['damageTakenOnTeamPercentage'] ?? 0) * 100) . '%', 'norm' => min(($c['damageTakenOnTeamPercentage'] ?? 0) / 0.30, 1)],

            'turretPlate' => ['stat' => (string) ($c['turretPlatesTaken'] ?? 0),    'norm' => min(($c['turretPlatesTaken'] ?? 0) / 6, 1)],
            'soloKills'   => ['stat' => (string) ($c['soloKills'] ?? 0),            'norm' => min(($c['soloKills'] ?? 0) / 3, 1)],
            'csAt10'      => ['stat' => (string) ($c['laneMinionsFirst10Minutes'] ?? 0), 'norm' => min(($c['laneMinionsFirst10Minutes'] ?? 0) / 80, 1)],
            'towerDmg'    => ['stat' => number_format($p['damageDealtToTurrets'] ?? 0), 'norm' => min(($p['damageDealtToTurrets'] ?? 0) / 12000, 1)],
            'wards'       => ['stat' => (string) ($p['wardsPlaced'] ?? 0),          'norm' => min(($p['wardsPlaced'] ?? 0) / 25, 1)],
            'controlWard' => ['stat' => (string) ($c['controlWardsPlaced'] ?? 0),   'norm' => min(($c['controlWardsPlaced'] ?? 0) / 4, 1)],
            'heal'        => ['stat' => number_format(round($heal)),                'norm' => min($heal / $minutes / 700, 1)],
            'cc'          => ['stat' => round($cc) . ' sn',                         'norm' => min(($cc / $minutes) / 1.5, 1)],

            // ELW #7 (2026-06-30) — granül metrikler (DPM-uyumlu). norm 0..1, visionAdv işaretli.
            'wardsKilled' => ['stat' => (string) ($c['wardTakedowns'] ?? 0),                          'norm' => min(($c['wardTakedowns'] ?? 0) / 6, 1)],
            'pickKill'    => ['stat' => (string) ($c['pickKillWithAlly'] ?? 0),                       'norm' => min(($c['pickKillWithAlly'] ?? 0) / 12, 1)],
            'saveAlly'    => ['stat' => (string) ($c['saveAllyFromDeath'] ?? 0),                      'norm' => min(($c['saveAllyFromDeath'] ?? 0) / 2, 1)],
            'visionAdv'   => ['stat' => number_format($c['visionScoreAdvantageLaneOpponent'] ?? 0, 1), 'norm' => max(-1, min(($c['visionScoreAdvantageLaneOpponent'] ?? 0) / 1.2, 1))],
            'grubs'       => ['stat' => (string) ($c['voidMonsterKill'] ?? 0),                        'norm' => min(($c['voidMonsterKill'] ?? 0) / 5, 1)],
            'turretTd'    => ['stat' => (string) ($c['turretTakedowns'] ?? 0),                        'norm' => min(($c['turretTakedowns'] ?? 0) / 6, 1)],
            'diveKill'    => ['stat' => (string) ($c['killsNearEnemyTurret'] ?? 0),                   'norm' => min(($c['killsNearEnemyTurret'] ?? 0) / 3, 1)],
            'counterJg'   => ['stat' => (string) ($c['enemyJungleMonsterKills'] ?? 0),               'norm' => min(($c['enemyJungleMonsterKills'] ?? 0) / 12, 1)],
            'earlyGank'   => ['stat' => (string) ($c['killsOnLanersEarlyJungleAsJungler'] ?? 0),     'norm' => min(($c['killsOnLanersEarlyJungleAsJungler'] ?? 0) / 4, 1)],
            'roamKill'    => ['stat' => (string) ($c['killsOnOtherLanesEarlyJungleAsLaner'] ?? 0),    'norm' => min(($c['killsOnOtherLanesEarlyJungleAsLaner'] ?? 0) / 3, 1)],
            'earlyLead'   => ['stat' => (($c['earlyLaningPhaseGoldExpAdvantage'] ?? 0) >= 1) ? 'Evet' : 'Hayır', 'norm' => (($c['earlyLaningPhaseGoldExpAdvantage'] ?? 0) >= 1) ? 1 : 0],
        ];

        // vs Rakip — koridor rakibiyle fark (işaretli -1..1).
        $opp = $ctx['oppMap'][$p['puuid']] ?? null;
        if ($opp) {
            $oppCs = ($opp['totalMinionsKilled'] ?? 0) + ($opp['neutralMinionsKilled'] ?? 0);
            $goldD = ($p['goldEarned'] ?? 0) - ($opp['goldEarned'] ?? 0);
            $csD = $cs - $oppCs;
            $m['goldDiff'] = ['stat' => $this->signed($goldD), 'norm' => max(-1, min($goldD / 4000, 1))];
            $m['csDiff']   = ['stat' => $this->signed($csD),   'norm' => max(-1, min($csD / 40, 1))];

            $xp = $ctx['xpMap'][$p['puuid']] ?? null;
            $oxp = $ctx['xpMap'][$opp['puuid']] ?? null;
            if ($xp !== null && $oxp !== null) {
                $xpD = $xp - $oxp;
                $m['xpDiff'] = ['stat' => $this->signed($xpD), 'norm' => max(-1, min($xpD / 3000, 1))];
            }
        }

        return $m;
    }

    /** Her oyuncuya aynı roldeki düşman oyuncuyu eşle (vs-Rakip için). puuid → rakip. */
    private function buildOpponentMap(array $participants): array
    {
        $byTeamRole = [];
        foreach ($participants as $p) {
            $role = ($p['teamPosition'] ?? '') ?: ($p['individualPosition'] ?? '');
            if ($role) {
                $byTeamRole[$p['teamId']][$role] = $p;
            }
        }
        $map = [];
        foreach ($participants as $p) {
            $role = ($p['teamPosition'] ?? '') ?: ($p['individualPosition'] ?? '');
            if (!$role) {
                continue;
            }
            foreach ($byTeamRole as $teamId => $roles) {
                if ($teamId !== $p['teamId'] && isset($roles[$role])) {
                    $map[$p['puuid']] = $roles[$role];
                    break;
                }
            }
        }
        return $map;
    }

    /** Oyun sonu XP haritası (timeline son frame). Yoksa boş → XP farkı atlanır. puuid → xp. */
    private function buildXpMap(array $participants, ?array $timeline): array
    {
        if (!$timeline || empty($timeline['info']['frames'])) {
            return [];
        }
        $frames = $timeline['info']['frames'];
        $last = end($frames);
        if (!$last || empty($last['participantFrames'])) {
            return [];
        }
        // participantFrames pid (1-10) → katılımcı sırası
        $map = [];
        foreach ($participants as $i => $p) {
            $pid = (string) ($i + 1);
            if (isset($last['participantFrames'][$pid]['xp'])) {
                $map[$p['puuid']] = $last['participantFrames'][$pid]['xp'];
            }
        }
        return $map;
    }

    private function signed(int|float $n): string
    {
        $r = round($n);
        return ($r > 0 ? '+' : '') . number_format($r);
    }

    /**
     * Kategorileri modal kontratına çevir: her kategori harf notu + metrikler.
     */
    private function formatCategories(array $rawCats, string $role): array
    {
        $weights = self::ROLE_W[$role] ?? self::ROLE_W['MIDDLE'];
        $out = [];
        foreach (self::CATEGORIES as $cat) {
            $metrics = $rawCats[$cat] ?? [];
            if (empty($metrics)) {
                continue; // bu role bu kategori yok (ör. ADC'de heal)
            }
            // Kategori notu: alınan puan / mümkün max pozitif puan.
            $maxPos = 0.0;
            $got = 0.0;
            foreach ($metrics as $m) {
                $got += $m['points'];
                if ($m['weight'] > 0) {
                    $maxPos += $m['weight'];
                }
            }
            $out[] = [
                'key'     => $cat,
                'label'   => self::CAT_LABELS[$cat],
                'grade'   => $this->ratioGrade($maxPos > 0 ? $got / $maxPos : 0),
                'metrics' => array_map(fn ($m) => [
                    'key'    => $m['key'],
                    'label'  => $m['label'],
                    'stat'   => $m['stat'],
                    'points' => round($m['points'], 1),
                ], $metrics),
            ];
        }
        return $out;
    }

    /** ELW skoru (0-10) → harf notu (DPM-tarzı). */
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

    /** Oran (0-1) → kategori harf notu. */
    private function ratioGrade(float $r): string
    {
        return match (true) {
            $r >= 0.80 => 'S+',
            $r >= 0.65 => 'S',
            $r >= 0.50 => 'A',
            $r >= 0.35 => 'B',
            $r >= 0.20 => 'C',
            default    => 'D',
        };
    }

    /** Oyuncunun rolünü çöz (BOT→BOTTOM; UTILITY→tank/damage/enchanter alt-tip). */
    private function resolveRole(array $p): string
    {
        $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
        if ($role === 'BOT') {
            $role = 'BOTTOM';
        }
        if ($role === 'UTILITY') {
            $c = $p['challenges'] ?? [];
            $hs = ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0);
            $dmg = $p['totalDamageDealtToChampions'] ?? 0;
            $tankShare = $c['damageTakenOnTeamPercentage'] ?? 0;
            if ($tankShare >= 0.18 && $hs < $dmg) {
                $role = 'UTILITY_TANK';
            } else {
                $role = ($dmg > $hs) ? 'UTILITY_DAMAGE' : 'UTILITY_ENCHANTER';
            }
        }
        return $role ?: 'MIDDLE';
    }

    /**
     * Ham skoru rolün ortalamasına böl → role-relatif (mükemmel destek = mükemmel ADC).
     * HİBRİT: böleni baselineBlend (α) kadar global ham ortalamaya karıştırır →
     * effectiveBaseline = (1-α)·roleBaseline + α·globalBaseline. α=0 tam role-relatif,
     * α=1 tam ham etki (carry'ler öne çıkar). Bkz. config/elwgraphs.php#elw_score.
     */
    private function roleAdjusted(float $raw, string $role): float
    {
        $base = self::ROLE_BASELINE[$role] ?? 7.5;
        $eff  = (1 - $this->baselineBlend) * $base + $this->baselineBlend * $this->globalBaseline;
        return $raw / ($eff > 0 ? $eff : 7.5);
    }

    // ────────────────────────────────────────────
    //  Normalizasyon (lobi içi z-score → 0-10)
    // ────────────────────────────────────────────

    /** Ham skor dizisinden lobi ortalaması + std sapma. */
    private function lobbyStats(array $scores, bool $rawValues = false): array
    {
        $raw = $rawValues ? $scores : array_column($scores, 'score');
        $avg = array_sum($raw) / max(count($raw), 1);
        $variance = 0;
        foreach ($raw as $rs) {
            $variance += ($rs - $avg) ** 2;
        }
        $stdDev = max(sqrt($variance / max(count($raw), 1)), 0.5);
        return [$avg, $stdDev];
    }

    /**
     * Z-score → 0-10 ELW skoru. Asimetrik eğri: iyi tarafta cömert (z=0 → 5.4,
     * MVP z≈2.5 → ~9.5), kötü tarafta lineer/düşük.
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
     * Harman ELW — göreceli (lobi z-score) + mutlak (ham skor). Mutlak bileşen sayesinde
     * iyi oynayan BİRDEN ÇOK oyuncu da ~10'a çıkabilir. Ham ölçek metrik sayısına göre
     * değiştiğinden mutlak referans dinamik (ortalama + 1.5×std ≈ "mükemmel").
     */
    private function blendedElw(float $raw, float $avg, float $stdDev): float
    {
        $z = ($raw - $avg) / max($stdDev, 0.5);
        $rel = $this->zToElw($z);
        $absRef = max($avg + 1.5 * $stdDev, 0.5);
        $abs = max(0, min(10, $raw / $absRef * 10));
        return round(0.5 * $rel + 0.5 * $abs, 1);
    }

    /** Lineer z-score normalizasyon (takım kalitesi — 5 = lobi ortalaması). */
    private function normalizeScores(array $scores): array
    {
        [$avg, $stdDev] = $this->lobbyStats($scores);
        $result = [];
        foreach ($scores as $s) {
            $z = ($s['score'] - $avg) / $stdDev;
            $result[$s['puuid']] = round(max(0, min(10, 5 + $z * 1.8)), 1);
        }
        return $result;
    }

    /** Cömert normalizasyon (maç kartı başlığıyla aynı ölçek). */
    private function normalizeScoresGenerous(array $scores): array
    {
        [$avg, $stdDev] = $this->lobbyStats($scores);
        $result = [];
        foreach ($scores as $s) {
            $result[$s['puuid']] = $this->blendedElw($s['score'], $avg, $stdDev);
        }
        return $result;
    }

    // ────────────────────────────────────────────
    //  Performans etiketi (timeline tabanlı)
    // ────────────────────────────────────────────

    public function calculatePerformanceLabel(array $ranking, array $player, array $info, ?array $timeline): ?array
    {
        $rank = $ranking['rank'];
        $win = $player['win'];
        $kda = $player['deaths'] > 0
            ? ($player['kills'] + $player['assists']) / $player['deaths']
            : ($player['kills'] + $player['assists']);

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
                    $earlyGoldLead = ($earlyFrame['participantFrames'][$pid]['totalGold'] ?? 0) - $getAvgGold($earlyFrame);
                }
                $lastFrame = end($frames);
                if ($lastFrame && isset($lastFrame['participantFrames'][$pid])) {
                    $lateGoldLead = ($lastFrame['participantFrames'][$pid]['totalGold'] ?? 0) - $getAvgGold($lastFrame);
                }
            }
        }

        $labels = \App\Models\AdminSetting::getValue('performance_labels', self::DEFAULT_LABELS);
        foreach ($labels as $l) {
            $c = $l['conditions'] ?? [];
            if (isset($c['win']) && $c['win'] !== null && (bool) $c['win'] !== $win) continue;
            if (isset($c['rank_max']) && $rank > $c['rank_max']) continue;
            if (isset($c['rank_min']) && $rank < $c['rank_min']) continue;
            if (isset($c['kda_min']) && $kda < $c['kda_min']) continue;
            if (isset($c['earlyGold_max']) && ($earlyGoldLead === null || $earlyGoldLead >= $c['earlyGold_max'])) continue;
            if (isset($c['earlyGold_min']) && ($earlyGoldLead === null || $earlyGoldLead <= $c['earlyGold_min'])) continue;
            if (isset($c['lateGold_min']) && ($lateGoldLead === null || $lateGoldLead <= $c['lateGold_min'])) continue;
            if (isset($c['lateGold_max']) && ($lateGoldLead === null || $lateGoldLead >= $c['lateGold_max'])) continue;

            return ['label' => $l['label'], 'desc' => $l['desc'], 'color' => $l['color']];
        }
        return null;
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
