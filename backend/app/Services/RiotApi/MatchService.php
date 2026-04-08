<?php

namespace App\Services\RiotApi;

/**
 * Maç geçmişi orkestratör servisi.
 *
 * Alt servisleri koordine ederek SummonerController'a veri sunar.
 * Kendi iş mantığı yoktur — sadece birleştirir.
 */
class MatchService
{
    public function __construct(
        private MatchDataService $matchData,
        private MatchFormatterService $formatter,
        private ElwScoreService $elw,
        private BadgeService $badges,
        private LaneAnalysisService $laneAnalysis,
        private MatchStatisticsService $statistics,
        private DataDragonService $ddragon,
        private LeagueService $league,
    ) {}

    // ────────────────────────────────────────────
    //  Maç Detay — 10 oyuncunun tam istatistikleri
    // ────────────────────────────────────────────

    public function getMatchDetailFull(string $matchId): array
    {
        $detail = $this->matchData->getMatchDetail($matchId);
        $info = $detail['info'];
        $version = $this->ddragon->getCurrentVersion();
        $ddragonBase = config('riot.ddragon_url');

        $runeMap = $this->ddragon->getRuneMap();
        $spellMap = $this->ddragon->getSpellMap();
        $allItems = $this->ddragon->getItems();

        // Takımlar
        $teams = [];
        foreach ($info['teams'] as $team) {
            $teamId = $team['teamId'];
            $teams[$teamId] = [
                'teamId'  => $teamId,
                'win'     => $team['win'],
                'bans'    => array_map(fn($b) => [
                    'championId' => $b['championId'],
                    'image'      => $b['championId'] > 0
                        ? $this->matchData->getChampImageById($b['championId'])
                        : null,
                ], $team['bans'] ?? []),
                'objectives' => $team['objectives'] ?? [],
                'totalKills' => 0,
                'totalGold'  => 0,
            ];
        }

        // Şampiyon yeteneklerini toplu çek
        $champAbilities = $this->buildChampAbilities($info['participants'], $version, $ddragonBase);

        // Oyuncu verilerini derle
        $players = [];
        foreach ($info['participants'] as $p) {
            $tid = $p['teamId'];
            $items = $this->buildPlayerItems($p, $allItems, $version, $ddragonBase);
            $spell1 = $spellMap[$p['summoner1Id'] ?? 0] ?? ['name' => '?', 'image' => ''];
            $spell2 = $spellMap[$p['summoner2Id'] ?? 0] ?? ['name' => '?', 'image' => ''];
            $runes = $this->formatter->extractRunes($p['perks'] ?? null, $runeMap);

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
                    'abilities' => $champAbilities[$p['championName']] ?? null,
                ],
                'champLevel'     => $p['champLevel'],
                'teamId'         => $tid,
                'win'            => $p['win'],
                'kills'          => $p['kills'],
                'deaths'         => $p['deaths'],
                'assists'        => $p['assists'],
                'kda'            => $p['deaths'] > 0 ? $kda : 'Perfect',
                'killParticipation' => 0,
                'cs'             => $cs,
                'csPerMin'       => $csPerMin,
                'gold'           => $p['goldEarned'],
                'damage'         => $p['totalDamageDealtToChampions'],
                'physicalDamage' => $p['physicalDamageDealtToChampions'] ?? 0,
                'magicDamage'    => $p['magicDamageDealtToChampions'] ?? 0,
                'trueDamage'     => $p['trueDamageDealtToChampions'] ?? 0,
                'damageTaken'    => $p['totalDamageTaken'],
                'healing'        => $p['totalHeal'] ?? 0,
                'teamHealing'    => ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0),
                'visionScore'    => $p['visionScore'] ?? 0,
                'wardsPlaced'    => $p['wardsPlaced'] ?? 0,
                'wardsKilled'    => $p['wardsKilled'] ?? 0,
                'towerDamage'    => $p['damageDealtToTurrets'] ?? 0,
                'objectiveDamage'=> $p['damageDealtToObjectives'] ?? 0,
                'challenges'     => [
                    'soloKills'          => $p['challenges']['soloKills'] ?? 0,
                    'damagePerMinute'    => $p['challenges']['damagePerMinute'] ?? 0,
                    'goldPerMinute'      => $p['challenges']['goldPerMinute'] ?? 0,
                    'killParticipation'  => $p['challenges']['killParticipation'] ?? 0,
                    'visionScorePerMin'  => $p['challenges']['visionScorePerMinute'] ?? 0,
                    'turretPlatesTaken'  => $p['challenges']['turretPlatesTaken'] ?? 0,
                    'teamDamagePct'      => $p['challenges']['teamDamagePercentage'] ?? 0,
                    'damageTakenPct'     => $p['challenges']['damageTakenOnTeamPercentage'] ?? 0,
                    'epicMonsterSteals'  => $p['challenges']['epicMonsterSteals'] ?? 0,
                    'skillshotsHit'      => $p['challenges']['skillshotsHit'] ?? 0,
                    'skillshotsDodged'   => $p['challenges']['skillshotsDodged'] ?? 0,
                    'laneMinions10'      => $p['challenges']['laneMinionsFirst10Minutes'] ?? 0,
                    'csAdvantage'        => $p['challenges']['maxCsAdvantageOnLaneOpponent'] ?? 0,
                    'firstBloodKill'     => $p['challenges']['firstBloodKill'] ?? false,
                    'firstTowerKill'     => $p['challenges']['firstTowerKill'] ?? false,
                    'controlWardsPlaced' => $p['challenges']['controlWardsPlaced'] ?? 0,
                    'survivedLowHp'      => $p['challenges']['survivedSingleDigitHpCount'] ?? 0,
                ],
                'items'          => $items,
                'spells'         => [$spell1, $spell2],
                'runes'          => $runes,
                'role'           => ($p['teamPosition'] ?: $p['individualPosition'] ?: '') === 'BOT' ? 'BOTTOM' : ($p['teamPosition'] ?: $p['individualPosition'] ?: ''),
                'doubleKills'    => $p['doubleKills'] ?? 0,
                'tripleKills'    => $p['tripleKills'] ?? 0,
                'quadraKills'    => $p['quadraKills'] ?? 0,
                'pentaKills'     => $p['pentaKills'] ?? 0,
                'badges'         => $this->badges->calculateBadges($p, $info),
                'tier'           => null,
                'rankDivision'   => null,
            ];
        }

        // Rank bilgisi
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

        // Kill participation
        foreach ($players as &$pl) {
            $teamKills = $teams[$pl['teamId']]['totalKills'];
            $pl['killParticipation'] = $teamKills > 0
                ? round(($pl['kills'] + $pl['assists']) / $teamKills * 100)
                : 0;
        }
        unset($pl);

        // ELW Score — iki mod
        $elwIndividual = $this->elw->calculateAllElwScores($info['participants'], $info['gameDuration'] ?? 0, 'individual');
        $elwTeam = $this->elw->calculateAllElwScores($info['participants'], $info['gameDuration'] ?? 0, 'team');
        foreach ($players as &$pl) {
            $pl['elwScore'] = $elwIndividual[$pl['puuid']] ?? 5.0;
            $pl['elwScoreTeam'] = $elwTeam[$pl['puuid']] ?? 5.0;
        }
        unset($pl);

        // Sıralama — her mod için ayrı rank
        $sortIndiv = $players;
        usort($sortIndiv, fn($a, $b) => $b['elwScore'] <=> $a['elwScore']);
        $rankMap = [];
        foreach ($sortIndiv as $i => $sp) { $rankMap[$sp['puuid']] = $i + 1; }

        $sortTeam = $players;
        usort($sortTeam, fn($a, $b) => $b['elwScoreTeam'] <=> $a['elwScoreTeam']);
        $rankMapTeam = [];
        foreach ($sortTeam as $i => $sp) { $rankMapTeam[$sp['puuid']] = $i + 1; }

        foreach ($players as &$pl) {
            $pl['matchRank'] = $rankMap[$pl['puuid']] ?? 10;
            $pl['matchRankTeam'] = $rankMapTeam[$pl['puuid']] ?? 10;
        }
        unset($pl);

        // Timeline verileri — item purchase + skill order
        $this->enrichPlayersWithTimeline($players, $matchId, $info, $allItems, $version, $ddragonBase);

        // Takımlara ayır
        $team100 = array_values(array_filter($players, fn($p) => $p['teamId'] === 100));
        $team200 = array_values(array_filter($players, fn($p) => $p['teamId'] === 200));

        // Lane analysis
        $laneAnalysisResult = $this->laneAnalysis->buildAnalysis($team100, $team200, $info['gameDuration']);

        // Default scoring mode
        $queueId = $info['queueId'] ?? 0;
        $defaultMode = in_array($queueId, [420]) ? 'individual' : 'team';

        return [
            'matchId'      => $matchId,
            'queueType'    => MatchDataService::QUEUE_NAMES[$queueId] ?? 'Diğer',
            'queueId'      => $queueId,
            'duration'     => $info['gameDuration'],
            'gameCreation' => $info['gameCreation'],
            'defaultScoringMode' => $defaultMode,
            'teams'        => [
                ['info' => $teams[100] ?? null, 'players' => $team100],
                ['info' => $teams[200] ?? null, 'players' => $team200],
            ],
            'laneAnalysis' => $laneAnalysisResult,
        ];
    }

    // ────────────────────────────────────────────
    //  Son Maçlar — Özet liste
    // ────────────────────────────────────────────

    public function getRecentMatchesPaginated(string $puuid, int $count = 10, int $start = 0): array
    {
        return $this->getRecentMatches($puuid, $count, $start);
    }

    public function getRecentMatches(string $puuid, int $count = 20, int $start = 0): array
    {
        $matchIds = $this->matchData->getMatchIds($puuid, $count, $start);
        $version = $this->ddragon->getCurrentVersion();
        $ddragonBase = config('riot.ddragon_url');

        $runeMap = $this->ddragon->getRuneMap();
        $spellMap = $this->ddragon->getSpellMap();
        $allItems = $this->ddragon->getItems();

        $matches = [];
        foreach ($matchIds as $matchId) {
            try {
                $detail = $this->matchData->getMatchDetail($matchId);
                $info = $detail['info'];

                $player = null;
                foreach ($info['participants'] as $p) {
                    if ($p['puuid'] === $puuid) {
                        $player = $p;
                        break;
                    }
                }
                if (!$player) continue;

                $ranking = $this->elw->calculateMatchRanking($info['participants'], $player['puuid'], $info['gameDuration'] ?? 0);

                $timeline = $this->matchData->getMatchTimeline($matchId);
                $perfLabel = $this->elw->calculatePerformanceLabel($ranking, $player, $info, $timeline);

                // Items
                $items = [];
                for ($i = 0; $i <= 6; $i++) {
                    $itemId = $player["item{$i}"] ?? 0;
                    if ($itemId > 0) {
                        $itemData = $allItems[(string) $itemId] ?? null;
                        $items[] = [
                            'id'    => $itemId,
                            'name'  => $itemData['name'] ?? '',
                            'desc'  => $this->formatter->parseItemDescription($itemData['description'] ?? ''),
                            'gold'  => $itemData['gold']['total'] ?? 0,
                            'image' => "{$ddragonBase}/cdn/{$version}/img/item/{$itemId}.png",
                        ];
                    }
                }

                // Spells
                $spells = [
                    $spellMap[$player['summoner1Id'] ?? 0] ?? ['name' => '?', 'image' => ''],
                    $spellMap[$player['summoner2Id'] ?? 0] ?? ['name' => '?', 'image' => ''],
                ];

                // Runes
                $runes = $this->formatter->extractRunes($player['perks'] ?? null, $runeMap);

                // Takımlar
                $playerTeam = $player['teamId'];
                $allies = [];
                $enemies = [];
                foreach ($info['participants'] as $p) {
                    $entry = [
                        'name'      => $p['championName'],
                        'image'     => $this->ddragon->championIconUrl($p['championName']),
                        'isMe'      => $p['puuid'] === $puuid,
                        'gameName'  => $p['riotIdGameName'] ?? $p['summonerName'] ?? '?',
                        'tagLine'   => $p['riotIdTagline'] ?? '',
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
                    'queueType'    => MatchDataService::QUEUE_NAMES[$info['queueId'] ?? 0] ?? 'Diğer',
                    'role'         => ($player['teamPosition'] ?: $player['individualPosition'] ?: '') === 'BOT' ? 'BOTTOM' : ($player['teamPosition'] ?: $player['individualPosition'] ?: ''),
                    'gameCreation' => $info['gameCreation'],
                    'champLevel'   => $player['champLevel'],
                    'doubleKills'  => $player['doubleKills'] ?? 0,
                    'tripleKills'  => $player['tripleKills'] ?? 0,
                    'quadraKills'  => $player['quadraKills'] ?? 0,
                    'pentaKills'   => $player['pentaKills'] ?? 0,
                    'badges'       => $this->badges->calculateBadges($player, $info),
                    'ranking'      => $ranking,
                    'perfLabel'    => $perfLabel,
                    'missions'     => $player['missions'] ?? null,
                ];
            } catch (\Exception $e) {
                continue;
            }
        }

        return $matches;
    }

    // ────────────────────────────────────────────
    //  Delegated — İstatistik servisi proxy'leri
    // ────────────────────────────────────────────

    public function getSeasonRoleStats(string $puuid): array
    {
        return $this->statistics->getSeasonRoleStats($puuid);
    }

    public function getWinrateTimeline(string $puuid): array
    {
        return $this->statistics->getWinrateTimeline($puuid);
    }

    public function getSeasonChampionStats(string $puuid): array
    {
        return $this->statistics->getSeasonChampionStats($puuid);
    }

    public function calculateRecentStats(array $matches, string $puuid): array
    {
        return $this->statistics->calculateRecentStats($matches, $puuid);
    }

    // ────────────────────────────────────────────
    //  Private helpers
    // ────────────────────────────────────────────

    /**
     * Şampiyon yeteneklerini toplu çek (cache'li, her şampiyon 1 kez).
     */
    private function buildChampAbilities(array $participants, string $version, string $ddragonBase): array
    {
        $champAbilities = [];
        $uniqueChamps = array_unique(array_column($participants, 'championName'));

        foreach ($uniqueChamps as $champName) {
            try {
                $champData = $this->ddragon->getChampionDetail($champName);
                $abilities = ['passive' => null, 'Q' => null, 'W' => null, 'E' => null, 'R' => null];
                if (!empty($champData['passive'])) {
                    $abilities['passive'] = [
                        'name'  => $champData['passive']['name'] ?? '',
                        'image' => "{$ddragonBase}/cdn/{$version}/img/passive/{$champData['passive']['image']['full']}",
                    ];
                }
                foreach (['Q' => 0, 'W' => 1, 'E' => 2, 'R' => 3] as $key => $idx) {
                    if (!empty($champData['spells'][$idx])) {
                        $spell = $champData['spells'][$idx];
                        $abilities[$key] = [
                            'name'  => $spell['name'] ?? '',
                            'image' => "{$ddragonBase}/cdn/{$version}/img/spell/{$spell['image']['full']}",
                        ];
                    }
                }
                $champAbilities[$champName] = $abilities;
            } catch (\Exception $e) {
                $champAbilities[$champName] = null;
            }
        }

        return $champAbilities;
    }

    /**
     * Oyuncunun item listesini oluştur.
     */
    private function buildPlayerItems(array $p, array $allItems, string $version, string $ddragonBase): array
    {
        $items = [];
        for ($i = 0; $i <= 6; $i++) {
            $itemId = $p["item{$i}"] ?? 0;
            $itemData = $itemId > 0 ? ($allItems[(string) $itemId] ?? null) : null;
            $items[] = $itemId > 0 ? [
                'id'    => $itemId,
                'name'  => $itemData['name'] ?? '',
                'desc'  => $this->formatter->parseItemDescription($itemData['description'] ?? ''),
                'gold'  => $itemData['gold']['total'] ?? 0,
                'image' => "{$ddragonBase}/cdn/{$version}/img/item/{$itemId}.png",
            ] : null;
        }
        return $items;
    }

    /**
     * Timeline verilerinden item purchase + skill order bilgilerini oyunculara ekle.
     */
    private function enrichPlayersWithTimeline(array &$players, string $matchId, array $info, array $allItems, string $version, string $ddragonBase): void
    {
        $timeline = $this->matchData->getMatchTimeline($matchId);
        if (!$timeline || !isset($timeline['info']['frames'])) return;

        $puuidToParticipant = [];
        foreach ($info['participants'] as $idx => $tp) {
            $puuidToParticipant[$tp['puuid']] = $idx + 1;
        }
        $participantToPuuid = array_flip($puuidToParticipant);

        $itemTimelines = [];
        $skillOrders = [];
        foreach ($players as $pl) {
            $itemTimelines[$pl['puuid']] = [];
            $skillOrders[$pl['puuid']] = [];
        }

        foreach ($timeline['info']['frames'] as $frame) {
            foreach ($frame['events'] ?? [] as $event) {
                $pid = $event['participantId'] ?? null;
                $puuid = $pid ? ($participantToPuuid[$pid] ?? null) : null;
                if (!$puuid) continue;

                $timestamp = intval(($event['timestamp'] ?? 0) / 1000);

                if ($event['type'] === 'ITEM_PURCHASED') {
                    $itemId = $event['itemId'] ?? 0;
                    if ($itemId <= 0) continue;
                    $itemData = $allItems[(string) $itemId] ?? null;
                    $itemGold = $itemData['gold']['total'] ?? 0;
                    if ($itemGold < 300) continue;
                    $itemTimelines[$puuid][] = [
                        'timestamp' => $timestamp,
                        'itemId'    => $itemId,
                        'name'      => $itemData['name'] ?? '',
                        'image'     => "{$ddragonBase}/cdn/{$version}/img/item/{$itemId}.png",
                        'gold'      => $itemGold,
                    ];
                }

                if ($event['type'] === 'SKILL_LEVEL_UP') {
                    $skillSlot = $event['skillSlot'] ?? null;
                    $levelUpType = $event['levelUpType'] ?? 'NORMAL';
                    if ($skillSlot && $levelUpType === 'NORMAL') {
                        $skillKey = ['Q', 'W', 'E', 'R'][$skillSlot - 1] ?? '?';
                        $skillOrders[$puuid][] = [
                            'level'     => count($skillOrders[$puuid]) + 1,
                            'skillSlot' => $skillSlot,
                            'skillKey'  => $skillKey,
                            'timestamp' => $timestamp,
                        ];
                    }
                }
            }
        }

        foreach ($players as &$pl) {
            $pl['itemTimeline'] = $itemTimelines[$pl['puuid']] ?? [];
            $pl['skillOrder'] = $skillOrders[$pl['puuid']] ?? [];
        }
        unset($pl);
    }
}
