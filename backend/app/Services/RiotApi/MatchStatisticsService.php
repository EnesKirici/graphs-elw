<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

/**
 * Sezon istatistikleri ve çoklu maç aggregation servisi.
 * Koridor stats, winrate timeline, şampiyon stats, son maç özeti.
 */
class MatchStatisticsService
{
    private const ROLE_LABELS = ['TOP' => 'Top', 'JUNGLE' => 'Jungle', 'MIDDLE' => 'Mid', 'BOTTOM' => 'ADC', 'UTILITY' => 'Support'];
    private const ROLE_ICONS  = ['TOP' => 'top', 'JUNGLE' => 'jungle', 'MIDDLE' => 'mid', 'BOTTOM' => 'bot', 'UTILITY' => 'support'];

    public function __construct(
        private MatchDataService $matchData,
        private DataDragonService $ddragon,
    ) {}

    /**
     * Sezon boyunca oynanmış ranked maçlardan koridor istatistikleri.
     */
    public function getSeasonRoleStats(string $puuid): array
    {
        $cacheKey = "season_roles:v3:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $queues = [
                420 => 'solo',
                440 => 'flex',
                400 => 'normal',
                430 => 'normal',
                490 => 'normal',
            ];

            $result = ['all' => [], 'solo' => [], 'flex' => [], 'normal' => []];
            $rawByKey = ['solo' => [], 'flex' => [], 'normal' => []];

            foreach ($queues as $queueId => $queueKey) {
                try {
                    $matchIds = $this->matchData->getSeasonMatchIds($puuid, $queueId);
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->matchData->getMatchDetail($matchId);
                        foreach ($detail['info']['participants'] as $p) {
                            if ($p['puuid'] === $puuid) {
                                $role = $p['teamPosition'] ?: $p['individualPosition'] ?: '';
                                if (!$role) break;
                                if ($role === 'BOT') $role = 'BOTTOM';
                                if (!isset($rawByKey[$queueKey][$role])) $rawByKey[$queueKey][$role] = ['games' => 0, 'wins' => 0];
                                $rawByKey[$queueKey][$role]['games']++;
                                if ($p['win']) $rawByKey[$queueKey][$role]['wins']++;
                                break;
                            }
                        }
                    } catch (\Exception $e) {
                        continue;
                    }
                }
            }

            // Her kuyruk tipi için sıralı dizi oluştur
            foreach (['solo', 'flex', 'normal'] as $queueKey) {
                $roleData = $rawByKey[$queueKey];
                arsort($roleData);
                $sorted = [];
                foreach ($roleData as $key => $rd) {
                    $sorted[] = [
                        'role'    => $key,
                        'label'   => self::ROLE_LABELS[$key] ?? $key,
                        'icon'    => '/roles/' . (self::ROLE_ICONS[$key] ?? strtolower($key)) . '.webp',
                        'games'   => $rd['games'],
                        'wins'    => $rd['wins'],
                        'losses'  => $rd['games'] - $rd['wins'],
                        'winRate' => $rd['games'] > 0 ? round($rd['wins'] / $rd['games'] * 100, 1) : 0,
                    ];
                }
                $result[$queueKey] = $sorted;
            }

            // "all" = solo + flex + normal birleşik
            $allData = [];
            foreach (['solo', 'flex', 'normal'] as $q) {
                foreach ($result[$q] as $r) {
                    $key = $r['role'];
                    if (!isset($allData[$key])) $allData[$key] = ['games' => 0, 'wins' => 0, 'role' => $key, 'label' => $r['label'], 'icon' => $r['icon']];
                    $allData[$key]['games'] += $r['games'];
                    $allData[$key]['wins'] += $r['wins'];
                }
            }
            usort($allData, fn($a, $b) => $b['games'] <=> $a['games']);
            $result['all'] = array_map(fn($r) => [
                ...$r,
                'losses'  => $r['games'] - $r['wins'],
                'winRate' => $r['games'] > 0 ? round($r['wins'] / $r['games'] * 100, 1) : 0,
            ], array_values($allData));

            // Main role tespiti
            $result['mainRole'] = $this->detectMainRole($result['all']);

            return $result;
        });
    }

    /**
     * Sezon boyunca ranked winrate geçmişi — solo ve flex ayrı.
     */
    public function getWinrateTimeline(string $puuid): array
    {
        $cacheKey = "winrate_timeline:v5:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $result = ['solo' => null, 'flex' => null];

            foreach ([420 => 'solo', 440 => 'flex'] as $queueId => $key) {
                $matches = [];
                try {
                    $matchIds = $this->matchData->getSeasonMatchIds($puuid, $queueId);
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->matchData->getMatchDetail($matchId);

                        if (($detail['info']['gameDuration'] ?? 0) < 300) continue;

                        foreach ($detail['info']['participants'] as $p) {
                            if ($p['puuid'] === $puuid) {
                                $matches[] = [
                                    'time' => $detail['info']['gameCreation'],
                                    'win'  => $p['win'],
                                ];
                                break;
                            }
                        }
                    } catch (\Exception $e) {
                        continue;
                    }
                }

                usort($matches, fn($a, $b) => $a['time'] <=> $b['time']);

                $wins = 0;
                $total = 0;
                $timeline = [];
                foreach ($matches as $m) {
                    $total++;
                    if ($m['win']) $wins++;
                    $timeline[] = [
                        'game'      => $total,
                        'winRate'   => round($wins / $total * 100, 1),
                        'date'      => date('d M', (int) ($m['time'] / 1000)),
                        'timestamp' => $m['time'],
                    ];
                }

                $result[$key] = [
                    'timeline' => $timeline,
                    'wins'     => $wins,
                    'losses'   => $total - $wins,
                    'games'    => $total,
                    'winRate'  => $total > 0 ? round($wins / $total * 100, 1) : 0,
                ];
            }

            return $result;
        });
    }

    /**
     * Sezon boyunca oynanmış maçlardan şampiyon istatistikleri.
     */
    public function getSeasonChampionStats(string $puuid): array
    {
        $cacheKey = "season_champs:v4:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $queues = [
                420 => 'ranked',
                440 => 'ranked',
                400 => 'normal',
                430 => 'normal',
                490 => 'normal',
            ];

            $emptyChamp = [
                'games' => 0,
                'wins' => 0,
                'kills' => 0,
                'deaths' => 0,
                'assists' => 0,
                'cs' => 0,
                'gold' => 0,
                'duration' => 0,
                'pentaKills' => 0,
                'quadraKills' => 0,
                'tripleKills' => 0,
                'doubleKills' => 0,
            ];

            $rawByType = ['ranked' => [], 'normal' => []];

            foreach ($queues as $queueId => $type) {
                try {
                    $matchIds = $this->matchData->getSeasonMatchIds($puuid, $queueId);
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->matchData->getMatchDetail($matchId);

                        $gameDuration = $detail['info']['gameDuration'] ?? 0;
                        if ($gameDuration < 300) continue;

                        foreach ($detail['info']['participants'] as $p) {
                            if ($p['puuid'] === $puuid) {
                                $name = $p['championName'];
                                if (!isset($rawByType[$type][$name])) {
                                    $rawByType[$type][$name] = $emptyChamp;
                                }
                                $rawByType[$type][$name]['games']++;
                                if ($p['win']) $rawByType[$type][$name]['wins']++;
                                $rawByType[$type][$name]['kills']       += $p['kills'];
                                $rawByType[$type][$name]['deaths']      += $p['deaths'];
                                $rawByType[$type][$name]['assists']     += $p['assists'];
                                $rawByType[$type][$name]['cs']          += ($p['totalMinionsKilled'] ?? 0) + ($p['neutralMinionsKilled'] ?? 0);
                                $rawByType[$type][$name]['gold']        += $p['goldEarned'] ?? 0;
                                $rawByType[$type][$name]['duration']    += $gameDuration;
                                $rawByType[$type][$name]['pentaKills']  += $p['pentaKills'] ?? 0;
                                $rawByType[$type][$name]['quadraKills'] += $p['quadraKills'] ?? 0;
                                $rawByType[$type][$name]['tripleKills'] += $p['tripleKills'] ?? 0;
                                $rawByType[$type][$name]['doubleKills'] += $p['doubleKills'] ?? 0;
                                break;
                            }
                        }
                    } catch (\Exception $e) {
                        continue;
                    }
                }
            }

            // "all" = ranked + normal birleşik
            $allData = [];
            foreach (['ranked', 'normal'] as $type) {
                foreach ($rawByType[$type] as $name => $d) {
                    if (!isset($allData[$name])) {
                        $allData[$name] = $emptyChamp;
                    }
                    foreach (array_keys($emptyChamp) as $field) {
                        $allData[$name][$field] += $d[$field];
                    }
                }
            }

            $result = [];
            foreach (['all' => $allData, 'ranked' => $rawByType['ranked'], 'normal' => $rawByType['normal']] as $key => $champData) {
                uasort($champData, fn($a, $b) => $b['games'] <=> $a['games']);
                $list = [];
                foreach ($champData as $name => $d) {
                    $g = $d['games'];
                    $avgDuration = $g > 0 ? $d['duration'] / $g : 0;
                    $durationMinutes = $d['duration'] / 60;
                    $list[] = [
                        'championName'  => $name,
                        'championImage' => $this->ddragon->championIconUrl($name),
                        'games'         => $g,
                        'wins'          => $d['wins'],
                        'losses'        => $g - $d['wins'],
                        'winRate'       => $g > 0 ? round($d['wins'] / $g * 100, 1) : 0,
                        'avgKda'        => [
                            'kills'   => round($d['kills'] / $g, 1),
                            'deaths'  => round($d['deaths'] / $g, 1),
                            'assists' => round($d['assists'] / $g, 1),
                            'ratio'   => $d['deaths'] > 0
                                ? round(($d['kills'] + $d['assists']) / $d['deaths'], 2)
                                : 'Perfect',
                        ],
                        'avgDuration'   => round($avgDuration / 60, 1),
                        'csPerMin'      => $durationMinutes > 0 ? round($d['cs'] / $durationMinutes, 1) : 0,
                        'goldPerMin'    => $durationMinutes > 0 ? round($d['gold'] / $durationMinutes) : 0,
                        'totalCs'       => $d['cs'],
                        'totalGold'     => $d['gold'],
                        'pentaKills'    => $d['pentaKills'],
                        'quadraKills'   => $d['quadraKills'],
                        'tripleKills'   => $d['tripleKills'],
                        'doubleKills'   => $d['doubleKills'],
                    ];
                }
                $result[$key] = $list;
            }

            return $result;
        });
    }

    /**
     * Son maçlardan istatistik hesapla.
     */
    public function calculateRecentStats(array $matches, string $puuid): array
    {
        // Remake maçları (5 dakikadan kısa) istatistiklere dahil edilmez
        $matches = array_values(array_filter(
            $matches,
            fn($m) => ($m['duration'] ?? $m['gameDuration'] ?? 0) >= 300
        ));

        if (empty($matches)) {
            return [
                'mostPlayedChampion' => null,
                'avgKDA' => ['kills' => 0, 'deaths' => 0, 'assists' => 0, 'ratio' => 0],
                'winRate' => 0,
                'wins' => 0,
                'losses' => 0,
                'totalGames' => 0,
            ];
        }

        $totalGames = count($matches);
        $wins = count(array_filter($matches, fn($m) => $m['win']));
        $totalKills = array_sum(array_column($matches, 'kills'));
        $totalDeaths = array_sum(array_column($matches, 'deaths'));
        $totalAssists = array_sum(array_column($matches, 'assists'));

        // En çok oynanan şampiyon
        $champCounts = [];
        foreach ($matches as $m) {
            $name = $m['champion']['name'];
            $champCounts[$name] = ($champCounts[$name] ?? 0) + 1;
        }
        arsort($champCounts);
        $topChampName = array_key_first($champCounts);

        // Rol analizi
        $roleData = [];
        foreach ($matches as $m) {
            $role = $m['role'] ?? '';
            if (!$role) continue;
            if (!isset($roleData[$role])) $roleData[$role] = ['games' => 0, 'wins' => 0];
            $roleData[$role]['games']++;
            if ($m['win']) $roleData[$role]['wins']++;
        }

        // Rol istatistikleri
        $roleStats = [];
        arsort($roleData);
        foreach ($roleData as $key => $rd) {
            $roleStats[] = [
                'role'    => $key,
                'label'   => self::ROLE_LABELS[$key] ?? $key,
                'icon'    => '/roles/' . (self::ROLE_ICONS[$key] ?? strtolower($key)) . '.webp',
                'games'   => $rd['games'],
                'wins'    => $rd['wins'],
                'losses'  => $rd['games'] - $rd['wins'],
                'winRate' => $rd['games'] > 0 ? round($rd['wins'] / $rd['games'] * 100, 1) : 0,
            ];
        }

        // Main role tespiti
        $mainRole = $this->detectMainRole($roleStats);

        // Sık alınan rozetler
        $badgeCounts = [];
        foreach ($matches as $m) {
            foreach ($m['badges'] ?? [] as $b) {
                $key = $b['key'];
                if (!isset($badgeCounts[$key])) {
                    $badgeCounts[$key] = ['count' => 0, 'label' => $b['label'], 'desc' => $b['desc'], 'category' => $b['category'], 'tier' => $b['tier']];
                }
                $badgeCounts[$key]['count']++;
                if ($b['tier'] === 'gold') $badgeCounts[$key]['tier'] = 'gold';
            }
        }
        uasort($badgeCounts, fn($a, $b) => $b['count'] <=> $a['count']);
        $frequentBadges = [];
        foreach ($badgeCounts as $key => $bc) {
            if ($bc['count'] < 2) continue;
            $frequentBadges[] = [
                'key'      => $key,
                'label'    => $bc['label'],
                'category' => $bc['category'],
                'tier'     => $bc['tier'],
                'count'    => $bc['count'],
                'rate'     => round($bc['count'] / $totalGames * 100),
            ];
        }

        // Negatif rozetler — kayıp serisi, kötü şampiyon WR
        $this->addNegativeProfileBadges($frequentBadges, $matches, $totalGames);

        return [
            'mostPlayedChampion' => [
                'id'    => $topChampName,
                'name'  => $topChampName,
                'image' => $this->ddragon->championIconUrl($topChampName),
                'games' => $champCounts[$topChampName],
            ],
            'avgKDA' => [
                'kills'   => round($totalKills / $totalGames, 1),
                'deaths'  => round($totalDeaths / $totalGames, 1),
                'assists' => round($totalAssists / $totalGames, 1),
                'ratio'   => $totalDeaths > 0
                    ? round(($totalKills + $totalAssists) / $totalDeaths, 2)
                    : 'Perfect',
            ],
            'winRate'    => round($wins / $totalGames * 100, 1),
            'wins'       => $wins,
            'losses'     => $totalGames - $wins,
            'totalGames' => $totalGames,
            'mainRole'   => $mainRole,
            'roleStats'  => $roleStats,
            'frequentBadges' => array_slice($frequentBadges, 0, 10),
        ];
    }

    /**
     * Profil-seviyesi negatif rozetler.
     * Kayıp serisi, belirli şampiyonla kötü WR gibi.
     */
    private function addNegativeProfileBadges(array &$badges, array $matches, int $totalGames): void
    {
        // 1) Kayıp Serisi — Mevcut kayıp serisini hesapla (en sondan başlayarak)
        $currentLoseStreak = 0;
        for ($i = 0; $i < count($matches); $i++) {
            if (!$matches[$i]['win']) {
                $currentLoseStreak++;
            } else {
                break;
            }
        }
        if ($currentLoseStreak >= 3) {
            $badges[] = [
                'key'      => 'lose_streak',
                'label'    => 'Kayıp Serisi',
                'category' => 'negative',
                'tier'     => 'silver',
                'count'    => $currentLoseStreak,
                'rate'     => round($currentLoseStreak / $totalGames * 100),
            ];
        }

        // 2) Kötü Şampiyon WR — Belirli bir şampiyonla %35 altı WR (en az 3 maç)
        $champStats = [];
        foreach ($matches as $m) {
            $name = $m['champion']['name'] ?? '';
            if (!$name) continue;
            if (!isset($champStats[$name])) $champStats[$name] = ['games' => 0, 'wins' => 0];
            $champStats[$name]['games']++;
            if ($m['win']) $champStats[$name]['wins']++;
        }
        foreach ($champStats as $name => $stat) {
            if ($stat['games'] >= 3) {
                $wr = round($stat['wins'] / $stat['games'] * 100);
                if ($wr <= 35) {
                    $badges[] = [
                        'key'      => 'bad_champ_' . strtolower(preg_replace('/[^a-zA-Z]/', '', $name)),
                        'label'    => $name . ' ile Kötü',
                        'category' => 'negative',
                        'tier'     => 'silver',
                        'count'    => $stat['games'],
                        'rate'     => $wr,
                    ];
                }
            }
        }
    }

    // Support oynarken anlamsız olan laning metrikleri
    private const LANING_METRICS = [
        'laneMinionsFirst10Minutes',
        'maxCsAdvantageOnLaneOpponent',
        'soloKills',
        'turretPlatesTaken',
    ];

    /**
     * Sezon maçlarından challenge ortalamalarını hesapla (DB-only, 0 API isteği).
     * Support maçlarında laning metrikleri (CS, solo kill, plaka) hariç tutulur.
     */
    public function getChallengeAverages(string $puuid): array
    {
        $cacheKey = "challenge_avgs:v3:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            try {
                $matchIds = $this->matchData->getAllSeasonMatchIds($puuid);
            } catch (\Exception $e) {
                return ['averages' => [], 'totalGames' => 0];
            }

            // Summoner's Rift queue'ları — Arena/ARAM/Bot/özel modları hariç
            $allowedQueues = [400, 420, 430, 440];

            $totals = [];
            $counts = []; // Metrik başına ayrı sayaç (support filtrelemesi için)

            foreach ($matchIds as $matchId) {
                try {
                    $detail = $this->matchData->getMatchDetail($matchId);
                } catch (\Exception $e) {
                    continue;
                }

                if (($detail['info']['gameDuration'] ?? 0) < 300) continue;
                if (!in_array($detail['info']['queueId'] ?? 0, $allowedQueues, true)) continue;

                foreach ($detail['info']['participants'] as $p) {
                    if ($p['puuid'] !== $puuid) continue;

                    $role = $p['teamPosition'] ?? '';
                    $isSupport = ($role === 'UTILITY');

                    $ch = $p['challenges'] ?? [];
                    foreach ($ch as $key => $val) {
                        if (!is_numeric($val) && !is_bool($val)) continue;

                        // Support maçlarında laning metriklerini hariç tut
                        if ($isSupport && in_array($key, self::LANING_METRICS, true)) continue;

                        $totals[$key] = ($totals[$key] ?? 0) + (is_bool($val) ? ($val ? 1 : 0) : $val);
                        $counts[$key] = ($counts[$key] ?? 0) + 1;
                    }
                    break;
                }
            }

            if (empty($counts)) return ['averages' => [], 'totalGames' => 0];

            $averages = [];
            foreach ($totals as $key => $total) {
                $averages[$key] = round($total / $counts[$key], 2);
            }

            $totalGames = max($counts);

            return ['averages' => $averages, 'totalGames' => $totalGames];
        });
    }

    /**
     * Sezon maçlarından duo partner tespiti (DB-only, 0 API isteği).
     *
     * Sadece Solo/Duo queue (420). Frekans eşiği:
     * - Minimum 2 maçta aynı takımda olma
     * - Toplam maç sayısının %5'inden fazla aynı takımda olma (yüksek elo filtresi)
     */
    public function getDuoPartners(string $puuid): array
    {
        $cacheKey = "duo_partners:v5:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            try {
                $matchIds = $this->matchData->getAllSeasonMatchIds($puuid);
            } catch (\Exception $e) {
                return [];
            }
            if (empty($matchIds)) return [];

            // Summoner's Rift queue'ları — Arena, ARAM, Bot ve özel modları hariç tut
            $allowedQueues = [400, 420, 430, 440];

            $totalMatches = 0;
            $teammates = [];

            foreach ($matchIds as $matchId) {
                try {
                    $detail = $this->matchData->getMatchDetail($matchId);
                } catch (\Exception $e) {
                    continue;
                }

                if (($detail['info']['gameDuration'] ?? 0) < 300) continue;

                $queueId = $detail['info']['queueId'] ?? 0;
                if (!in_array($queueId, $allowedQueues, true)) continue;

                $gameCreation = $detail['info']['gameCreation'] ?? 0;
                $totalMatches++;

                $myTeamId = null;
                $myWin = false;
                foreach ($detail['info']['participants'] as $p) {
                    if ($p['puuid'] === $puuid) {
                        $myTeamId = $p['teamId'];
                        $myWin = $p['win'];
                        break;
                    }
                }
                if (!$myTeamId) continue;

                foreach ($detail['info']['participants'] as $p) {
                    if ($p['puuid'] === $puuid) continue;
                    if ($p['teamId'] !== $myTeamId) continue;

                    $pid = $p['puuid'];
                    if (str_starts_with($pid, 'BOT')) continue;

                    if (!isset($teammates[$pid])) {
                        $teammates[$pid] = [
                            'puuid'       => $pid,
                            'gameName'    => $p['riotIdGameName'] ?? $p['summonerName'] ?? '?',
                            'tagLine'     => $p['riotIdTagline'] ?? '',
                            'profileIcon' => $p['profileIcon'] ?? 0,
                            'games'       => 0,
                            'wins'        => 0,
                            'losses'      => 0,
                            'lastPlayed'  => 0,
                            'champions'   => [],
                        ];
                    }

                    $teammates[$pid]['games']++;
                    $myWin ? $teammates[$pid]['wins']++ : $teammates[$pid]['losses']++;

                    if ($gameCreation > $teammates[$pid]['lastPlayed']) {
                        $teammates[$pid]['lastPlayed'] = $gameCreation;
                        $teammates[$pid]['gameName'] = $p['riotIdGameName'] ?? $p['summonerName'] ?? '?';
                        $teammates[$pid]['tagLine'] = $p['riotIdTagline'] ?? '';
                        $teammates[$pid]['profileIcon'] = $p['profileIcon'] ?? $teammates[$pid]['profileIcon'];
                    }

                    $champName = $p['championName'] ?? '';
                    if ($champName && !in_array($champName, $teammates[$pid]['champions'])) {
                        $teammates[$pid]['champions'][] = $champName;
                    }
                }
            }

            if ($totalMatches === 0) return [];

            // Frekans eşiği: minimum 2 maç VE toplam maçların %5'inden fazla
            $threshold = max(2, (int) ceil($totalMatches * 0.05));
            $duos = array_filter($teammates, fn($t) => $t['games'] >= $threshold);
            usort($duos, fn($a, $b) => $b['games'] <=> $a['games']);

            $result = [];
            foreach (array_slice(array_values($duos), 0, 10) as $duo) {
                $duo['winRate'] = $duo['games'] > 0 ? round($duo['wins'] / $duo['games'] * 100, 1) : 0;
                $duo['profileIconUrl'] = $this->ddragon->profileIconUrl($duo['profileIcon']);
                $duo['championImages'] = array_map(
                    fn($name) => $this->ddragon->championIconUrl($name),
                    array_slice($duo['champions'], 0, 3)
                );
                unset($duo['profileIcon']);
                $result[] = $duo;
            }

            return $result;
        });
    }

    /**
     * Rol listesinden main role tespiti.
     */
    private function detectMainRole(array $roleStats): ?string
    {
        if (empty($roleStats)) return null;

        // games alanına göre sırala (zaten sıralı olabilir ama garanti edelim)
        usort($roleStats, fn($a, $b) => $b['games'] <=> $a['games']);

        $mainRole = null;
        if (count($roleStats) >= 2) {
            $first  = $roleStats[0]['games'];
            $second = $roleStats[1]['games'];
            if ($second >= $first * 0.6) {
                $mainRole = $roleStats[0]['label'] . '/' . $roleStats[1]['label'] . ' Main';
            } else {
                $mainRole = $roleStats[0]['label'] . ' Main';
            }
        } elseif (count($roleStats) === 1) {
            $mainRole = $roleStats[0]['label'] . ' Main';
        }

        if (count($roleStats) >= 4) {
            $vals = array_column($roleStats, 'games');
            if ($vals[0] - end($vals) <= 1) {
                $mainRole = 'Fill';
            }
        }

        return $mainRole;
    }
}
