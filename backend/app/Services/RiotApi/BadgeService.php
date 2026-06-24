<?php

namespace App\Services\RiotApi;

/**
 * Maç performansına göre rozet hesaplama.
 * Tier sistemi LoL rank renklerine karşılık gelir:
 *   challenger > grandmaster > diamond > emerald > gold > silver
 */
class BadgeService
{
    /**
     * Oyuncunun maç performansına göre rozetlerini hesapla.
     */
    public function calculateBadges(array $p, array $info): array
    {
        $c = $p['challenges'] ?? [];
        $badges = [];
        $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
        if ($role === 'BOT') $role = 'BOTTOM';

        $this->addCombatBadges($badges, $p, $c);
        $this->addDamageBadges($badges, $p, $c, $role);
        $this->addFarmingBadges($badges, $c, $role);
        $this->addObjectiveBadges($badges, $c);
        $this->addVisionBadges($badges, $p, $c);
        $this->addTeamplayBadges($badges, $c);
        $this->addNegativeBadges($badges, $p, $c, $info);
        $this->addFallbackBadge($badges, $p);

        return $badges;
    }

    private function addCombatBadges(array &$badges, array $p, array $c): void
    {
        $soloKills = $c['soloKills'] ?? 0;
        if ($soloKills >= 2) {
            $tier = $soloKills >= 8 ? 'challenger' : ($soloKills >= 6 ? 'grandmaster' : ($soloKills >= 4 ? 'diamond' : ($soloKills >= 3 ? 'gold' : 'silver')));
            $badges[] = ['key' => 'solo_killer', 'label' => 'Düellocu', 'desc' => "{$soloKills} solo kill", 'category' => 'combat', 'tier' => $tier];
        }

        $kda = $p['deaths'] > 0 ? ($p['kills'] + $p['assists']) / $p['deaths'] : ($p['kills'] + $p['assists']);
        if ($kda >= 4 && ($p['kills'] + $p['assists']) >= 5) {
            $tier = $kda >= 15 ? 'challenger' : ($kda >= 10 ? 'grandmaster' : ($kda >= 7 ? 'diamond' : ($kda >= 5 ? 'emerald' : 'gold')));
            $badges[] = ['key' => 'high_kda', 'label' => 'Yüksek KDA', 'desc' => round($kda, 1) . ' KDA', 'category' => 'combat', 'tier' => $tier];
        }

        if ($p['deaths'] === 0 && $p['win']) {
            $ka = $p['kills'] + $p['assists'];
            $tier = $ka >= 15 ? 'challenger' : ($ka >= 10 ? 'diamond' : 'emerald');
            $badges[] = ['key' => 'immortal', 'label' => 'Ölümsüz', 'desc' => "0 ölüm, {$ka} K+A ile galibiyet", 'category' => 'combat', 'tier' => $tier];
        }

        if ($c['firstBloodKill'] ?? false) {  // slim challenges'tan (extractMatchData ham participant.firstBloodKill'den doldurur)
            $badges[] = ['key' => 'first_blood', 'label' => 'İlk Kan', 'desc' => 'İlk kanı aldı', 'category' => 'combat', 'tier' => 'gold'];
        }

        if (($p['pentaKills'] ?? 0) > 0) {
            $badges[] = ['key' => 'penta', 'label' => 'PENTA KILL', 'desc' => 'Pentakill yaptı!', 'category' => 'combat', 'tier' => 'challenger'];
        } elseif (($p['quadraKills'] ?? 0) > 0) {
            $badges[] = ['key' => 'quadra', 'label' => 'Quadra Kill', 'desc' => 'Quadrakill yaptı', 'category' => 'combat', 'tier' => 'grandmaster'];
        }

        $lowHp = $c['survivedSingleDigitHpCount'] ?? 0;
        if ($lowHp >= 1) {
            $tier = $lowHp >= 5 ? 'challenger' : ($lowHp >= 3 ? 'diamond' : ($lowHp >= 2 ? 'gold' : 'silver'));
            $badges[] = ['key' => 'survivor', 'label' => 'Son Nefes', 'desc' => "{$lowHp}x 10 HP altında hayatta kaldı", 'category' => 'combat', 'tier' => $tier];
        }

        $ssDodge = $c['skillshotsDodged'] ?? 0;
        if ($ssDodge >= 20) {
            $tier = $ssDodge >= 70 ? 'challenger' : ($ssDodge >= 50 ? 'diamond' : ($ssDodge >= 35 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'dodge_master', 'label' => 'Kaçış Ustası', 'desc' => "{$ssDodge} skillshot savuşturdu", 'category' => 'combat', 'tier' => $tier];
        }
    }

    private function addDamageBadges(array &$badges, array $p, array $c, string $role): void
    {
        $dmgPct = $c['teamDamagePercentage'] ?? 0;
        if ($dmgPct >= 0.28) {
            $tier = $dmgPct >= 0.50 ? 'challenger' : ($dmgPct >= 0.42 ? 'grandmaster' : ($dmgPct >= 0.35 ? 'diamond' : ($dmgPct >= 0.30 ? 'gold' : 'silver')));
            $badges[] = ['key' => 'damage_dealer', 'label' => 'Hasar Makinesi', 'desc' => "Takım hasarının %" . round($dmgPct * 100) . "'i", 'category' => 'damage', 'tier' => $tier];
        }

        $dpm = $c['damagePerMinute'] ?? 0;
        if ($dpm >= 600) {
            $tier = $dpm >= 1500 ? 'challenger' : ($dpm >= 1200 ? 'grandmaster' : ($dpm >= 1000 ? 'diamond' : ($dpm >= 800 ? 'emerald' : 'gold')));
            $badges[] = ['key' => 'high_dpm', 'label' => 'Yüksek DPM', 'desc' => round($dpm) . ' hasar/dk', 'category' => 'damage', 'tier' => $tier];
        }

        $tankPct = $c['damageTakenOnTeamPercentage'] ?? 0;
        if ($tankPct >= 0.28 && in_array($role, ['TOP', 'JUNGLE', 'UTILITY'])) {
            $tier = $tankPct >= 0.45 ? 'diamond' : ($tankPct >= 0.35 ? 'emerald' : 'gold');
            $badges[] = ['key' => 'tank', 'label' => 'Duvar', 'desc' => "Takım hasarının %" . round($tankPct * 100) . "'ini aldı", 'category' => 'damage', 'tier' => $tier];
        }
    }

    private function addFarmingBadges(array &$badges, array $c, string $role): void
    {
        $cs10 = round($c['laneMinionsFirst10Minutes'] ?? 0);
        if ($cs10 >= 65 && in_array($role, ['TOP', 'MIDDLE', 'BOTTOM'])) {
            $tier = $cs10 >= 95 ? 'challenger' : ($cs10 >= 88 ? 'grandmaster' : ($cs10 >= 80 ? 'diamond' : ($cs10 >= 72 ? 'emerald' : 'gold')));
            $badges[] = ['key' => 'cs_master', 'label' => 'CS Ustası', 'desc' => "10dk'da {$cs10} CS", 'category' => 'farming', 'tier' => $tier];
        }

        $csAdv = round($c['maxCsAdvantageOnLaneOpponent'] ?? 0);
        if ($csAdv >= 15) {
            $tier = $csAdv >= 60 ? 'challenger' : ($csAdv >= 40 ? 'diamond' : ($csAdv >= 25 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'cs_lead', 'label' => 'CS Baskını', 'desc' => "+{$csAdv} CS farkı (max)", 'category' => 'farming', 'tier' => $tier];
        }

        $gpm = $c['goldPerMinute'] ?? 0;
        if ($gpm >= 400) {
            $tier = $gpm >= 650 ? 'challenger' : ($gpm >= 550 ? 'diamond' : ($gpm >= 480 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'gold_maker', 'label' => 'Altın Madencisi', 'desc' => round($gpm) . ' gold/dk', 'category' => 'farming', 'tier' => $tier];
        }
    }

    private function addObjectiveBadges(array &$badges, array $c): void
    {
        $plates = $c['turretPlatesTaken'] ?? 0;
        if ($plates >= 3) {
            $tier = $plates >= 10 ? 'challenger' : ($plates >= 7 ? 'diamond' : ($plates >= 5 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'plate_taker', 'label' => 'Kule Yıkıcı', 'desc' => "{$plates} plaka aldı", 'category' => 'objective', 'tier' => $tier];
        }

        $steals = $c['epicMonsterSteals'] ?? 0;
        if ($steals >= 1) {
            $tier = $steals >= 3 ? 'challenger' : ($steals >= 2 ? 'grandmaster' : 'diamond');
            $badges[] = ['key' => 'objective_steal', 'label' => 'Hırsız', 'desc' => "{$steals} objektif çaldı", 'category' => 'objective', 'tier' => $tier];
        }

        if ($c['firstTowerKill'] ?? false) {
            $badges[] = ['key' => 'first_tower', 'label' => 'İlk Kule', 'desc' => 'İlk kuleyi yıktı', 'category' => 'objective', 'tier' => 'gold'];
        }
    }

    private function addVisionBadges(array &$badges, array $p, array $c): void
    {
        $vsPerMin = $c['visionScorePerMinute'] ?? 0;
        if ($vsPerMin >= 1.0) {
            $tier = $vsPerMin >= 2.5 ? 'challenger' : ($vsPerMin >= 2.0 ? 'diamond' : ($vsPerMin >= 1.5 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'vision_master', 'label' => 'Görüş Ustası', 'desc' => round($vsPerMin, 1) . ' VS/dk', 'category' => 'vision', 'tier' => $tier];
        }

        $controlWards = $c['controlWardsPlaced'] ?? ($p['detectorWardsPlaced'] ?? 0);
        if ($controlWards >= 4) {
            $tier = $controlWards >= 15 ? 'diamond' : ($controlWards >= 10 ? 'emerald' : ($controlWards >= 7 ? 'gold' : 'silver'));
            $badges[] = ['key' => 'ward_master', 'label' => 'Ward Ustası', 'desc' => "{$controlWards} kontrol ward'ı koydu", 'category' => 'vision', 'tier' => $tier];
        }
    }

    private function addTeamplayBadges(array &$badges, array $c): void
    {
        $kp = $c['killParticipation'] ?? 0;
        if ($kp >= 0.65) {
            $tier = $kp >= 0.90 ? 'challenger' : ($kp >= 0.80 ? 'diamond' : ($kp >= 0.72 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'team_player', 'label' => 'Takım Oyuncusu', 'desc' => "%" . round($kp * 100) . " kill katılımı", 'category' => 'teamplay', 'tier' => $tier];
        }
    }

    /**
     * Negatif / kötü performans rozetleri.
     * Oyuncunun zayıf anlarını gösterir.
     */
    private function addNegativeBadges(array &$badges, array $p, array $c, array $info): void
    {
        // 1) Erken Ölüm — 10dk içinde 3+ ölüm
        $deathsByEnemyChamps = $c['deathsByEnemyChamps'] ?? 0;
        $gameDuration = $info['gameDuration'] ?? 0;
        $gameDurationMin = $gameDuration / 60;

        // challenges'dan erken ölüm bilgisi — killsUnderOwnTurret veya deathsByEnemyChamps
        // Eğer toplam ölüm 3+ ve maç kısa süre ise veya ortalama 10dk'ya göre hesapla
        $totalDeaths = $p['deaths'] ?? 0;
        if ($gameDurationMin > 0 && $totalDeaths >= 3) {
            $deathsPer10Min = ($totalDeaths / $gameDurationMin) * 10;
            if ($deathsPer10Min >= 3) {
                $badges[] = [
                    'key' => 'early_death',
                    'label' => 'Erken Ölüm',
                    'desc' => "10dk'da ort. " . round($deathsPer10Min, 1) . " ölüm",
                    'category' => 'negative',
                    'tier' => 'silver',
                ];
            }
        }

        // 2) Altın Kaybı — Takım goldda önde ama maç kaybedilmiş
        if (!$p['win']) {
            $myTeamId = $p['teamId'] ?? 0;
            $teams = $info['teams'] ?? [];
            $myTeamObj = null;
            $enemyTeamObj = null;
            foreach ($teams as $team) {
                if (($team['teamId'] ?? 0) === $myTeamId) {
                    $myTeamObj = $team;
                } else {
                    $enemyTeamObj = $team;
                }
            }

            // Takım altın hesabı — tüm oyuncuların goldEarned toplamı
            $participants = $info['participants'] ?? [];
            $myTeamGold = 0;
            $enemyTeamGold = 0;
            foreach ($participants as $part) {
                if (($part['teamId'] ?? 0) === $myTeamId) {
                    $myTeamGold += $part['goldEarned'] ?? 0;
                } else {
                    $enemyTeamGold += $part['goldEarned'] ?? 0;
                }
            }

            if ($myTeamGold > $enemyTeamGold && $myTeamGold > 0) {
                $goldLead = $myTeamGold - $enemyTeamGold;
                $badges[] = [
                    'key' => 'gold_loss',
                    'label' => 'Altın Kaybı',
                    'desc' => "Takım +" . number_format($goldLead) . " gold önde ama kaybetti",
                    'category' => 'negative',
                    'tier' => 'silver',
                ];
            }
        }
    }

    private function addFallbackBadge(array &$badges, array $p): void
    {
        if (empty($badges) && $p['deaths'] >= 6) {
            $messages = [
                'Bazen böyle günler de olur...',
                'Bir dahaki sefere!',
                'Her maç ders verir.',
                'Gri ekran',
                'Rakip bugün şanslıydı.',
                'Takım arkadaşların seni özledi.',
                'Speedrun denemesi',
                'Harita karanlıktı zaten...',
                'Dosta Korku, Düşmana Güven..'
            ];
            $badges[] = [
                'key' => 'rough_game',
                'label' => '????',
                'desc' => $messages[array_rand($messages)],
                'category' => 'misc',
                'tier' => 'silver',
            ];
        }
    }
}
