<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

/**
 * Maç geçmişi servisi — Match-V5 API (EUROPE regional routing).
 *
 * Riot'un en zengin API'si. Her maçta 10 oyuncunun tüm istatistikleri var.
 * Response çok büyük (~400 alan) → sadece lazım olanları çekip frontend'e gönderiyoruz.
 */
class MatchService
{
    // Queue ID → okunabilir isim
    private const QUEUE_NAMES = [
        420 => 'Solo/Duo',
        440 => 'Flex',
        450 => 'ARAM',
        400 => 'Normal',
        430 => 'Blind',
        490 => 'Quickplay',
        700 => 'Clash',
        900 => 'URF',
        1700 => 'Arena',
    ];

    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
        private LeagueService $league,
    ) {}

    /**
     * Son N maçın ID'lerini getir.
     */
    public function getMatchIds(string $puuid, int $count = 20, int $start = 0): array
    {
        $cacheKey = "match:ids:{$puuid}:{$count}:{$start}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $count, $start) {
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['count' => $count, 'start' => $start]
            );
        });
    }

    /**
     * Tek bir maçın detayını getir.
     * Maçlar değişmez → uzun süre cache'le.
     */
    public function getMatchDetail(string $matchId): array
    {
        return Cache::remember("match:detail:{$matchId}", config('riot.cache_ttl.match_detail'), function () use ($matchId) {
            return $this->api->regionRequest(
                "/lol/match/v5/matches/{$matchId}"
            );
        });
    }

    /**
     * Tek bir maçın tüm detayını frontend-friendly formatta döner.
     * 10 oyuncunun tam istatistikleri, takım verileri, hasar, gözcüler vb.
     */
    public function getMatchDetailFull(string $matchId): array
    {
        $detail = $this->getMatchDetail($matchId);
        $info = $detail['info'];
        $version = $this->ddragon->getCurrentVersion();
        $ddragonBase = config('riot.ddragon_url');

        $runeMap = $this->ddragon->getRuneMap();
        $spellMap = $this->ddragon->getSpellMap();
        $allItems = $this->ddragon->getItems();

        $teams = [];
        foreach ($info['teams'] as $team) {
            $teamId = $team['teamId'];
            $teams[$teamId] = [
                'teamId'  => $teamId,
                'win'     => $team['win'],
                'bans'    => array_map(fn($b) => [
                    'championId' => $b['championId'],
                    'image'      => $b['championId'] > 0
                        ? $this->getChampImageById($b['championId'])
                        : null,
                ], $team['bans'] ?? []),
                'objectives' => $team['objectives'] ?? [],
                'totalKills' => 0,
                'totalGold'  => 0,
            ];
        }

        $players = [];
        foreach ($info['participants'] as $p) {
            $tid = $p['teamId'];

            // Items
            $items = [];
            for ($i = 0; $i <= 6; $i++) {
                $itemId = $p["item{$i}"] ?? 0;
                $itemData = $itemId > 0 ? ($allItems[(string) $itemId] ?? null) : null;
                $items[] = $itemId > 0 ? [
                    'id'    => $itemId,
                    'name'  => $itemData['name'] ?? '',
                    'desc'  => $this->parseItemDescription($itemData['description'] ?? ''),
                    'gold'  => $itemData['gold']['total'] ?? 0,
                    'image' => "{$ddragonBase}/cdn/{$version}/img/item/{$itemId}.png",
                ] : null;
            }

            // Spells
            $spell1 = $spellMap[$p['summoner1Id'] ?? 0] ?? ['name' => '?', 'image' => ''];
            $spell2 = $spellMap[$p['summoner2Id'] ?? 0] ?? ['name' => '?', 'image' => ''];

            // Runes
            $runes = $this->extractRunes($p['perks'] ?? null, $runeMap);

            $deaths = max($p['deaths'], 1);
            $kda = round(($p['kills'] + $p['assists']) / $deaths, 2);
            $cs = $p['totalMinionsKilled'] + ($p['neutralMinionsKilled'] ?? 0);
            $csPerMin = $info['gameDuration'] > 0
                ? round($cs / ($info['gameDuration'] / 60), 1)
                : 0;

            $teams[$tid]['totalKills'] += $p['kills'];
            $teams[$tid]['totalGold']  += $p['goldEarned'];

            $players[] = [
                'puuid'          => $p['puuid'],
                'summonerName'   => $p['riotIdGameName'] ?? $p['summonerName'] ?? '?',
                'tagLine'        => $p['riotIdTagline'] ?? '',
                'champion'       => [
                    'name'  => $p['championName'],
                    'image' => $this->ddragon->championIconUrl($p['championName']),
                ],
                'champLevel'     => $p['champLevel'],
                'teamId'         => $tid,
                'win'            => $p['win'],
                'kills'          => $p['kills'],
                'deaths'         => $p['deaths'],
                'assists'        => $p['assists'],
                'kda'            => $p['deaths'] > 0 ? $kda : 'Perfect',
                'killParticipation' => 0, // hesaplanacak
                'cs'             => $cs,
                'csPerMin'       => $csPerMin,
                'gold'           => $p['goldEarned'],
                'damage'         => $p['totalDamageDealtToChampions'],
                'damageTaken'    => $p['totalDamageTaken'],
                'healing'        => $p['totalHeal'] ?? 0,
                'visionScore'    => $p['visionScore'] ?? 0,
                'wardsPlaced'    => $p['wardsPlaced'] ?? 0,
                'wardsKilled'    => $p['wardsKilled'] ?? 0,
                'items'          => $items,
                'spells'         => [$spell1, $spell2],
                'runes'          => $runes,
                'role'           => $p['teamPosition'] ?: $p['individualPosition'] ?: '',
                'doubleKills'    => $p['doubleKills'] ?? 0,
                'tripleKills'    => $p['tripleKills'] ?? 0,
                'quadraKills'    => $p['quadraKills'] ?? 0,
                'pentaKills'     => $p['pentaKills'] ?? 0,
                'tier'           => null,
                'rankDivision'   => null,
            ];
        }

        // Rank bilgisi çek (her oyuncu için)
        foreach ($players as &$pl) {
            try {
                $ranked = $this->league->getRankedInfo($pl['puuid']);
                if ($ranked['solo'] ?? null) {
                    $pl['tier'] = $ranked['solo']['tier'];
                    $pl['rankDivision'] = $ranked['solo']['rank'];
                }
            } catch (\Exception $e) {}
        }
        unset($pl);

        // Kill participation hesapla
        foreach ($players as &$pl) {
            $teamKills = $teams[$pl['teamId']]['totalKills'];
            $pl['killParticipation'] = $teamKills > 0
                ? round(($pl['kills'] + $pl['assists']) / $teamKills * 100)
                : 0;
        }
        unset($pl);

        // Takımlara ayır
        $team100 = array_values(array_filter($players, fn($p) => $p['teamId'] === 100));
        $team200 = array_values(array_filter($players, fn($p) => $p['teamId'] === 200));

        return [
            'matchId'      => $matchId,
            'queueType'    => self::QUEUE_NAMES[$info['queueId'] ?? 0] ?? 'Diğer',
            'duration'     => $info['gameDuration'],
            'gameCreation' => $info['gameCreation'],
            'teams'        => [
                ['info' => $teams[100] ?? null, 'players' => $team100],
                ['info' => $teams[200] ?? null, 'players' => $team200],
            ],
        ];
    }

    /**
     * Champion ID'den görsel URL'i bul.
     */
    private function getChampImageById(int $championId): ?string
    {
        $champions = $this->ddragon->getChampions();
        foreach ($champions as $champ) {
            if ((int) $champ['key'] === $championId) {
                return $this->ddragon->championIconUrl($champ['id']);
            }
        }
        return null;
    }

    /**
     * Son N maçın özet bilgilerini getir.
     * Her maçtan sadece aranan oyuncunun verilerini çıkarır.
     */
    public function getRecentMatchesPaginated(string $puuid, int $count = 10, int $start = 0): array
    {
        return $this->getRecentMatches($puuid, $count, $start);
    }

    public function getRecentMatches(string $puuid, int $count = 20, int $start = 0): array
    {
        $matchIds = $this->getMatchIds($puuid, $count, $start);
        $version = $this->ddragon->getCurrentVersion();
        $ddragonBase = config('riot.ddragon_url');

        // Statik verileri bir kere çek (tüm maçlar için ortak)
        $runeMap = $this->ddragon->getRuneMap();
        $spellMap = $this->ddragon->getSpellMap();
        $allItems = $this->ddragon->getItems();

        $matches = [];
        foreach ($matchIds as $matchId) {
            try {
                $detail = $this->getMatchDetail($matchId);
                $info = $detail['info'];

                // Aranan oyuncuyu bul
                $player = null;
                foreach ($info['participants'] as $p) {
                    if ($p['puuid'] === $puuid) {
                        $player = $p;
                        break;
                    }
                }

                if (!$player) continue;

                // Item'ler (isim + açıklama dahil)
                $items = [];
                for ($i = 0; $i <= 6; $i++) {
                    $itemId = $player["item{$i}"] ?? 0;
                    if ($itemId > 0) {
                        $itemData = $allItems[(string) $itemId] ?? null;
                        $items[] = [
                            'id'    => $itemId,
                            'name'  => $itemData['name'] ?? '',
                            'desc'  => $this->parseItemDescription($itemData['description'] ?? ''),
                            'gold'  => $itemData['gold']['total'] ?? 0,
                            'image' => "{$ddragonBase}/cdn/{$version}/img/item/{$itemId}.png",
                        ];
                    }
                }

                // Summoner spell'ler
                $spell1Id = $player['summoner1Id'] ?? 0;
                $spell2Id = $player['summoner2Id'] ?? 0;
                $spells = [
                    $spellMap[$spell1Id] ?? ['name' => '?', 'image' => ''],
                    $spellMap[$spell2Id] ?? ['name' => '?', 'image' => ''],
                ];

                // Rünler — keystone + sub tree
                $perks = $player['perks'] ?? null;
                $runes = $this->extractRunes($perks, $runeMap);

                // Takımlar
                $playerTeam = $player['teamId'];
                $allies = [];
                $enemies = [];
                foreach ($info['participants'] as $p) {
                    $entry = [
                        'name'  => $p['championName'],
                        'image' => $this->ddragon->championIconUrl($p['championName']),
                        'isMe'  => $p['puuid'] === $puuid,
                    ];
                    if ($p['teamId'] === $playerTeam) {
                        $allies[] = $entry;
                    } else {
                        $enemies[] = $entry;
                    }
                }

                $matches[] = [
                    'matchId'      => $matchId,
                    'champion'     => [
                        'id'    => $player['championName'],
                        'name'  => $player['championName'],
                        'image' => $this->ddragon->championIconUrl($player['championName']),
                    ],
                    'kills'        => $player['kills'],
                    'deaths'       => $player['deaths'],
                    'assists'      => $player['assists'],
                    'kda'          => $player['deaths'] > 0
                        ? round(($player['kills'] + $player['assists']) / $player['deaths'], 2)
                        : 'Perfect',
                    'cs'           => $player['totalMinionsKilled'] + ($player['neutralMinionsKilled'] ?? 0),
                    'gold'         => $player['goldEarned'],
                    'damage'       => $player['totalDamageDealtToChampions'],
                    'items'        => $items,
                    'spells'       => $spells,
                    'runes'        => $runes,
                    'allies'       => $allies,
                    'enemies'      => $enemies,
                    'win'          => $player['win'],
                    'duration'     => $info['gameDuration'],
                    'queueType'    => self::QUEUE_NAMES[$info['queueId'] ?? 0] ?? 'Diğer',
                    'role'         => $player['teamPosition'] ?: $player['individualPosition'] ?: '',
                    'gameCreation' => $info['gameCreation'],
                    'champLevel'   => $player['champLevel'],
                    'doubleKills'  => $player['doubleKills'] ?? 0,
                    'tripleKills'  => $player['tripleKills'] ?? 0,
                    'quadraKills'  => $player['quadraKills'] ?? 0,
                    'pentaKills'   => $player['pentaKills'] ?? 0,
                ];
            } catch (\Exception $e) {
                continue;
            }
        }

        return $matches;
    }

    /**
     * Sezon boyunca oynanmış ranked maçlardan koridor istatistikleri.
     * SoloQ (420) ve Flex (440) ayrı ayrı + birleşik "all".
     */
    public function getSeasonRoleStats(string $puuid): array
    {
        $cacheKey = "season_roles:v2:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $roleLabels = ['TOP' => 'Top', 'JUNGLE' => 'Jungle', 'MIDDLE' => 'Mid', 'BOTTOM' => 'ADC', 'UTILITY' => 'Support'];
            $roleIcons  = ['TOP' => 'top', 'JUNGLE' => 'jungle', 'MIDDLE' => 'mid', 'BOTTOM' => 'bot', 'UTILITY' => 'support'];

            // Sezon başlangıcı: Ocak 2025
            $seasonStart = strtotime('2025-01-08');

            // Ranked + Normal kuyruklar
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
                    $matchIds = $this->api->regionRequest(
                        "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                        ['startTime' => $seasonStart, 'queue' => $queueId, 'count' => 100]
                    );
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->getMatchDetail($matchId);
                        foreach ($detail['info']['participants'] as $p) {
                            if ($p['puuid'] === $puuid) {
                                $role = $p['teamPosition'] ?: $p['individualPosition'] ?: '';
                                if (!$role) break;
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
                        'label'   => $roleLabels[$key] ?? $key,
                        'icon'    => '/roles/' . ($roleIcons[$key] ?? strtolower($key)) . '.png',
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

            // Main role tespiti — tüm veriden
            $mainRole = null;
            $sorted = $result['all'];
            if (count($sorted) >= 2) {
                $first  = $sorted[0]['games'];
                $second = $sorted[1]['games'];
                if ($second >= $first * 0.6) {
                    $mainRole = $sorted[0]['label'] . '/' . $sorted[1]['label'] . ' Main';
                } else {
                    $mainRole = $sorted[0]['label'] . ' Main';
                }
            } elseif (count($sorted) === 1) {
                $mainRole = $sorted[0]['label'] . ' Main';
            }
            if (count($sorted) >= 4) {
                $vals = array_column($sorted, 'games');
                if ($vals[0] - end($vals) <= 1) {
                    $mainRole = 'Fill';
                }
            }
            $result['mainRole'] = $mainRole;

            return $result;
        });
    }

    /**
     * Sezon boyunca ranked winrate geçmişi — kronolojik sırada.
     * Her maç sonrası kümülatif winrate hesaplar.
     * Ek API maliyeti yok — match detail'ler önceki metodlar tarafından zaten cache'li.
     */
    public function getWinrateTimeline(string $puuid): array
    {
        $cacheKey = "winrate_timeline:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $seasonStart = strtotime('2025-01-08');
            $matches = [];

            foreach ([420, 440] as $queueId) {
                try {
                    $matchIds = $this->api->regionRequest(
                        "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                        ['startTime' => $seasonStart, 'queue' => $queueId, 'count' => 100]
                    );
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->getMatchDetail($matchId);
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
            }

            // Kronolojik sırala
            usort($matches, fn($a, $b) => $a['time'] <=> $b['time']);

            // Kümülatif winrate hesapla
            $wins = 0;
            $total = 0;
            $timeline = [];

            foreach ($matches as $m) {
                $total++;
                if ($m['win']) $wins++;
                $timeline[] = [
                    'game'    => $total,
                    'winRate' => round($wins / $total * 100, 1),
                ];
            }

            return $timeline;
        });
    }

    /**
     * Sezon boyunca oynanmış ranked maçlardan şampiyon istatistikleri.
     * Her şampiyon için: oyun, galibiyet, mağlubiyet, winRate, ortalama KDA.
     */
    public function getSeasonChampionStats(string $puuid): array
    {
        $cacheKey = "season_champs:v2:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $seasonStart = strtotime('2025-01-08');

            $queues = [
                420 => 'ranked',
                440 => 'ranked',
                400 => 'normal',
                430 => 'normal',
                490 => 'normal',
            ];

            $rawByType = ['ranked' => [], 'normal' => []];

            foreach ($queues as $queueId => $type) {
                try {
                    $matchIds = $this->api->regionRequest(
                        "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                        ['startTime' => $seasonStart, 'queue' => $queueId, 'count' => 100]
                    );
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->getMatchDetail($matchId);
                        foreach ($detail['info']['participants'] as $p) {
                            if ($p['puuid'] === $puuid) {
                                $name = $p['championName'];
                                if (!isset($rawByType[$type][$name])) {
                                    $rawByType[$type][$name] = ['games' => 0, 'wins' => 0, 'kills' => 0, 'deaths' => 0, 'assists' => 0];
                                }
                                $rawByType[$type][$name]['games']++;
                                if ($p['win']) $rawByType[$type][$name]['wins']++;
                                $rawByType[$type][$name]['kills']   += $p['kills'];
                                $rawByType[$type][$name]['deaths']  += $p['deaths'];
                                $rawByType[$type][$name]['assists'] += $p['assists'];
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
                        $allData[$name] = ['games' => 0, 'wins' => 0, 'kills' => 0, 'deaths' => 0, 'assists' => 0];
                    }
                    $allData[$name]['games']   += $d['games'];
                    $allData[$name]['wins']    += $d['wins'];
                    $allData[$name]['kills']   += $d['kills'];
                    $allData[$name]['deaths']  += $d['deaths'];
                    $allData[$name]['assists'] += $d['assists'];
                }
            }

            $result = [];
            foreach (['all' => $allData, 'ranked' => $rawByType['ranked'], 'normal' => $rawByType['normal']] as $key => $champData) {
                uasort($champData, fn($a, $b) => $b['games'] <=> $a['games']);
                $list = [];
                foreach ($champData as $name => $d) {
                    $g = $d['games'];
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
                    ];
                }
                $result[$key] = $list;
            }

            return $result;
        });
    }

    /**
     * Item description HTML'ini yapılandırılmış veriye çevir.
     * Stats ve pasif açıklamaları ayrı ayrı döner.
     */
    private function parseItemDescription(string $html): array
    {
        $result = ['stats' => [], 'passives' => []];

        // Stats çıkar: <stats>...</stats> içindeki satırlar
        if (preg_match('/<stats>(.*?)<\/stats>/s', $html, $m)) {
            $statsHtml = $m[1];
            $statsHtml = preg_replace('/<attention>(.*?)<\/attention>/', '+$1', $statsHtml);
            // <br> ile böl
            $lines = explode('<br>', $statsHtml);
            foreach ($lines as $line) {
                $line = trim(strip_tags($line));
                if ($line) $result['stats'][] = $line;
            }
        }

        // Pasifler çıkar: <passive>İsim</passive> ve sonraki açıklama
        $descPart = preg_replace('/<stats>.*?<\/stats>/s', '', $html);
        $descPart = preg_replace('/<mainText>|<\/mainText>/', '', $descPart);

        if (preg_match_all('/<passive>(.*?)<\/passive>/s', $descPart, $passiveNames)) {
            $parts = preg_split('/<passive>.*?<\/passive>/s', $descPart);
            foreach ($passiveNames[1] as $i => $name) {
                $desc = isset($parts[$i + 1]) ? trim(strip_tags($parts[$i + 1])) : '';
                $desc = preg_replace('/^\s*<br\s*\/?>\s*/', '', $desc);
                $desc = trim(preg_replace('/\s+/', ' ', $desc));
                if ($name) {
                    $result['passives'][] = ['name' => $name, 'desc' => $desc];
                }
            }
        }

        return $result;
    }

    /**
     * Perks verisinden rün bilgilerini çıkar.
     */
    private function extractRunes(?array $perks, array $runeMap): array
    {
        if (!$perks || !isset($perks['styles'])) {
            return ['keystone' => null, 'primaryTree' => null, 'subTree' => null, 'allPerks' => []];
        }

        $keystone = null;
        $primaryTree = null;
        $subTree = null;
        $primaryPerks = [];
        $secondaryPerks = [];

        foreach ($perks['styles'] as $style) {
            $treeInfo = $runeMap[$style['style']] ?? null;

            if ($style['description'] === 'primaryStyle') {
                $primaryTree = $treeInfo;
                if (!empty($style['selections'])) {
                    $keystoneId = $style['selections'][0]['perk'];
                    $keystone = $runeMap[$keystoneId] ?? null;
                }
                foreach ($style['selections'] as $sel) {
                    $primaryPerks[] = $runeMap[$sel['perk']] ?? ['name' => 'Unknown', 'icon' => ''];
                }
            } elseif ($style['description'] === 'subStyle') {
                $subTree = $treeInfo;
                foreach ($style['selections'] as $sel) {
                    $secondaryPerks[] = $runeMap[$sel['perk']] ?? ['name' => 'Unknown', 'icon' => ''];
                }
            }
        }

        // Stat shards
        $statShardNames = [
            5001 => '+10-180 Can (seviyeye göre)',
            5002 => '+6 Zırh',
            5003 => '+8 Büyü Direnci',
            5005 => '+10% Saldırı Hızı',
            5007 => '+8 Yetenek İvmesi',
            5008 => '+9 Uyarlanır Güç',
            5010 => '+%1-10 CDR (seviyeye göre)',
            5011 => '+65 Can',
            5013 => '+10% Tenas',
        ];
        $statShards = [];
        if (isset($perks['statPerks'])) {
            foreach (['offense', 'flex', 'defense'] as $slot) {
                $id = $perks['statPerks'][$slot] ?? 0;
                $statShards[] = $statShardNames[$id] ?? "Shard #{$id}";
            }
        }

        return [
            'keystone'       => $keystone,
            'primaryTree'    => $primaryTree,
            'subTree'        => $subTree,
            'primaryPerks'   => $primaryPerks,
            'secondaryPerks' => $secondaryPerks,
            'statShards'     => $statShards,
        ];
    }

    /**
     * Son maçlardan istatistik hesapla.
     */
    public function calculateRecentStats(array $matches, string $puuid): array
    {
        if (empty($matches)) {
            return [
                'mostPlayedChampion' => null,
                'avgKDA' => ['kills' => 0, 'deaths' => 0, 'assists' => 0, 'ratio' => 0],
                'winRate' => 0,
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

        // Rol analizi — her koridor için oyun + win
        $roleLabels = ['TOP' => 'Top', 'JUNGLE' => 'Jungle', 'MIDDLE' => 'Mid', 'BOTTOM' => 'ADC', 'UTILITY' => 'Support'];
        $roleIcons  = ['TOP' => 'top', 'JUNGLE' => 'jungle', 'MIDDLE' => 'mid', 'BOTTOM' => 'bot', 'UTILITY' => 'support'];
        $roleData = [];
        foreach ($matches as $m) {
            $role = $m['role'] ?? '';
            if (!$role) continue;
            if (!isset($roleData[$role])) $roleData[$role] = ['games' => 0, 'wins' => 0];
            $roleData[$role]['games']++;
            if ($m['win']) $roleData[$role]['wins']++;
        }

        // Rol istatistikleri — oyun sayısına göre sıralı
        $roleStats = [];
        arsort($roleData);
        foreach ($roleData as $key => $rd) {
            $roleStats[] = [
                'role'    => $key,
                'label'   => $roleLabels[$key] ?? $key,
                'icon'    => '/roles/' . ($roleIcons[$key] ?? strtolower($key)) . '.png',
                'games'   => $rd['games'],
                'wins'    => $rd['wins'],
                'losses'  => $rd['games'] - $rd['wins'],
                'winRate' => $rd['games'] > 0 ? round($rd['wins'] / $rd['games'] * 100, 1) : 0,
            ];
        }

        // Main role tespiti
        $roleCounts = array_column($roleData, 'games', null);
        // roleData key'leri ile
        $sortedRoles = [];
        foreach ($roleData as $k => $v) $sortedRoles[$k] = $v['games'];
        arsort($sortedRoles);
        $roleKeys = array_keys($sortedRoles);

        // Main role tespiti
        $mainRole = null;
        if (count($roleKeys) >= 2) {
            $first = $sortedRoles[$roleKeys[0]];
            $second = $sortedRoles[$roleKeys[1]];
            if ($second >= $first * 0.6) {
                $mainRole = ($roleLabels[$roleKeys[0]] ?? $roleKeys[0]) . '/' . ($roleLabels[$roleKeys[1]] ?? $roleKeys[1]) . ' Main';
            } else {
                $mainRole = ($roleLabels[$roleKeys[0]] ?? $roleKeys[0]) . ' Main';
            }
        } elseif (count($roleKeys) === 1) {
            $mainRole = ($roleLabels[$roleKeys[0]] ?? $roleKeys[0]) . ' Main';
        }

        if (count($sortedRoles) >= 4) {
            $vals = array_values($sortedRoles);
            if ($vals[0] - end($vals) <= 1) {
                $mainRole = 'Fill';
            }
        }

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
            'totalGames' => $totalGames,
            'mainRole'   => $mainRole,
            'roleStats'  => $roleStats,
        ];
    }
}
