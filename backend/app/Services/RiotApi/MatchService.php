<?php

namespace App\Services\RiotApi;

use App\Models\CachedPlayer;

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
        $botIndex = 0;
        foreach ($info['participants'] as $p) {
            // Bot oyuncuların puuid'i "BOT" olabilir — unique yap
            if ($p['puuid'] === 'BOT' || $p['puuid'] === '' || str_starts_with($p['puuid'], 'BOT')) {
                $p['puuid'] = 'BOT_' . $botIndex++;
            }
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

            $isBot = str_starts_with($p['puuid'], 'BOT_');

            $players[] = [
                'puuid'          => $p['puuid'],
                'isBot'          => $isBot,
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
                    'outnumberedKills'   => $p['challenges']['outnumberedKills'] ?? 0,
                    'dragonTakedowns'    => $p['challenges']['dragonTakedowns'] ?? 0,
                    'baronTakedowns'     => $p['challenges']['baronTakedowns'] ?? 0,
                    'riftHeraldTakedowns'=> $p['challenges']['riftHeraldTakedowns'] ?? 0,
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
        // Bot puuid'lerini participants'ta da unique yap (ElwScore hesaplaması için)
        $fixedParticipants = $info['participants'];
        $bi = 0;
        foreach ($fixedParticipants as &$fp) {
            if ($fp['puuid'] === 'BOT' || $fp['puuid'] === '' || str_starts_with($fp['puuid'], 'BOT')) {
                $fp['puuid'] = 'BOT_' . $bi++;
            }
        }
        unset($fp);

        $elwIndividual = $this->elw->calculateAllElwScores($fixedParticipants, $info['gameDuration'] ?? 0, 'individual');
        $elwTeam = $this->elw->calculateAllElwScores($fixedParticipants, $info['gameDuration'] ?? 0, 'team');
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

        // Maçtaki 10 oyuncuyu veritabanına kaydet
        $this->cachePlayersFromMatchIds([$matchId]);

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

    public function getRecentMatches(string $puuid, int $count = 20, int $start = 0, bool $skipPreload = false): array
    {
        $matchIds = $this->matchData->getMatchIds($puuid, $count, $start);

        // buildFullResponse zaten preload yaptıysa tekrar yapma
        if (!$skipPreload) {
            $this->matchData->preloadMatchDetails($matchIds);
        }

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

                // Timeline DB'de varsa kullan, yoksa null (maç detayında çekilecek)
                $timeline = $this->matchData->getMatchTimelineIfExists($matchId);
                $perfLabel = $this->elw->calculatePerformanceLabel($ranking, $player, $info, $timeline);

                // Items — 7 sabit slot KORUNUR (boş slot = null). Aksi halde dizi
                // sıkışır ve totem (item6) boş yuvalara kayar; slot 7 yerine ortada durur.
                $items = [];
                for ($i = 0; $i <= 6; $i++) {
                    $itemId = $player["item{$i}"] ?? 0;
                    $itemData = $itemId > 0 ? ($allItems[(string) $itemId] ?? null) : null;
                    $items[] = $itemId > 0 ? [
                        'id'    => $itemId,
                        'name'  => $itemData['name'] ?? '',
                        'desc'  => $this->formatter->parseItemDescription($itemData['description'] ?? ''),
                        'gold'  => $itemData['gold']['total'] ?? 0,
                        'image' => "{$ddragonBase}/cdn/{$version}/img/item/{$itemId}.png",
                    ] : null;
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

                // ── Pro tasarım alanları: koridor rakibi + takım kalite + KP ──
                // Takım ağırlıklı ELW skorları (10 oyuncu, puuid => 0-10)
                $teamScores = $this->elw->calculateAllElwScores($info['participants'], $info['gameDuration'] ?? 0, 'team');

                // Koridor için yalnız teamPosition güvenilir (ARAM/eski maçta boş olabilir).
                // Sinerji eşi (kendi takımından): Top↔Orman, Mid↔Orman, ADC↔Destek, Orman↔Mid.
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

                $champEntry = function ($p, $role) {
                    return [
                        'name'     => $p['championName'],
                        'image'    => $this->ddragon->championIconUrl($p['championName']),
                        'gameName' => $p['riotIdGameName'] ?? $p['summonerName'] ?? '?',
                        'tagLine'  => $p['riotIdTagline'] ?? '',
                        'role'     => $role,
                    ];
                };

                foreach ($info['participants'] as $p) {
                    $pPos = $p['teamPosition'] ?? '';
                    if ($p['teamId'] === $playerTeam) {
                        $teamKills += $p['kills'];
                        if ($p['puuid'] !== $puuid) {
                            $myTeamSum += $teamScores[$p['puuid']] ?? 5;
                            $myTeamCount++;
                            // Sinerji koridor eşi (kendi takımından)
                            if ($partnerRole && !$laneDuo && $pPos === $partnerRole) {
                                $laneDuo = $champEntry($p, $partnerRole);
                            }
                        }
                    } else {
                        $enemySum += $teamScores[$p['puuid']] ?? 5;
                        $enemyCount++;
                        // Rakip koridor (aynı rol) + rakip eş (sinerji rolü)
                        if ($myRole && !$laneOpponent && $pPos === $myRole) {
                            $laneOpponent = $champEntry($p, $myRole);
                            $laneOpponentCs = ($p['totalMinionsKilled'] ?? 0) + ($p['neutralMinionsKilled'] ?? 0);
                        }
                        if ($partnerRole && !$enemyDuo && $pPos === $partnerRole) {
                            $enemyDuo = $champEntry($p, $partnerRole);
                        }
                    }
                }

                // Takım kalite: takım arkadaşları (kendisi hariç) ort. ELW − rakip ort. ELW
                $teamQuality = null;
                if ($myTeamCount > 0 && $enemyCount > 0) {
                    $diff = ($myTeamSum / $myTeamCount) - ($enemySum / $enemyCount);
                    if ($diff >= 1.2) {
                        $teamQuality = ['key' => 'great', 'label' => 'Çok iyi takım'];
                    } elseif ($diff >= 0.5) {
                        $teamQuality = ['key' => 'good', 'label' => 'İyi takım'];
                    } elseif ($diff > -0.5) {
                        $teamQuality = ['key' => 'avg', 'label' => 'Ort. takım'];
                    } elseif ($diff > -1.2) {
                        $teamQuality = ['key' => 'bad', 'label' => 'Kötü takım'];
                    } else {
                        $teamQuality = ['key' => 'terrible', 'label' => 'Çok kötü takım'];
                    }
                    $teamQuality['diff'] = round($diff, 2);
                    // Karşılaştırma grafiği için iki takımın ortalama ELW gücü (0-10).
                    $teamQuality['myAvg'] = round($myTeamSum / $myTeamCount, 1);
                    $teamQuality['enemyAvg'] = round($enemySum / $enemyCount, 1);
                }

                // Kill participation %
                $kp = $teamKills > 0 ? (int) round(($player['kills'] + $player['assists']) / $teamKills * 100) : 0;
                // CS / dakika
                $totalCs = $player['totalMinionsKilled'] + ($player['neutralMinionsKilled'] ?? 0);
                $csPerMin = ($info['gameDuration'] ?? 0) > 0 ? round($totalCs / ($info['gameDuration'] / 60), 1) : 0;

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
                    // Pro tasarım alanları (eski MatchCard bunları yok sayar)
                    'laneOpponent' => $laneOpponent,
                    'laneDuo'      => $laneDuo,
                    'enemyDuo'     => $enemyDuo,
                    'partnerRole'  => $partnerRole,
                    'teamQuality'  => $teamQuality,
                    'kp'           => $kp,
                    'csPerMin'     => $csPerMin,
                    // Koridor rakibine karşı toplam CS farkı (rol eşleşince)
                    'csDiff'       => ($laneOpponent && $laneOpponentCs !== null) ? ($totalCs - $laneOpponentCs) : null,
                ];
            } catch (\Exception $e) {
                continue;
            }
        }

        // Maçlardaki tüm oyuncuları veritabanına kaydet (autocomplete için)
        $this->cachePlayersFromMatchIds($matchIds);

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

    public function getLpTimeline(string $puuid, array $ranked): array
    {
        return $this->statistics->getLpTimeline($puuid, $ranked);
    }

    public function getAvgGameRank(string $puuid): ?array
    {
        return $this->statistics->getAvgGameRank($puuid);
    }

    public function getSeasonChampionStats(string $puuid): array
    {
        return $this->statistics->getSeasonChampionStats($puuid);
    }

    public function getPersonalityBadges(string $puuid): array
    {
        return $this->statistics->getPersonalityBadges($puuid);
    }

    public function calculateRecentStats(array $matches, string $puuid): array
    {
        return $this->statistics->calculateRecentStats($matches, $puuid);
    }

    public function getChallengeAverages(string $puuid): array
    {
        return $this->statistics->getChallengeAverages($puuid);
    }

    public function getDuoPartners(string $puuid): array
    {
        return $this->statistics->getDuoPartners($puuid);
    }

    // ────────────────────────────────────────────
    //  Private helpers
    // ────────────────────────────────────────────

    /**
     * Maçlardaki tüm oyuncuları CachedPlayer tablosuna kaydet (autocomplete için).
     * Zaten mevcut oyuncuları atlar, sadece yeni oyuncuları ekler.
     */
    private function cachePlayersFromMatchIds(array $matchIds): void
    {
        try {
            $seen = [];
            foreach ($matchIds as $matchId) {
                try {
                    $detail = $this->matchData->getMatchDetail($matchId);
                    foreach ($detail['info']['participants'] ?? [] as $p) {
                        $pid = $p['puuid'] ?? null;
                        if (!$pid || isset($seen[$pid])) continue;
                        $seen[$pid] = true;

                        $name = $p['riotIdGameName'] ?? $p['summonerName'] ?? null;
                        $tag = $p['riotIdTagline'] ?? null;
                        if (!$name || !$tag) continue;

                        CachedPlayer::firstOrCreate(
                            ['puuid' => $pid],
                            [
                                'game_name'       => $name,
                                'tag_line'        => $tag,
                                'profile_icon_id' => $p['profileIcon'] ?? null,
                                'summoner_level'  => $p['summonerLevel'] ?? null,
                            ]
                        );
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
        } catch (\Exception $e) {}
    }

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

        // participantId → puuid eşleştirmesi (players array'indeki fix'li puuid kullan)
        $participantToPuuid = [];
        foreach ($players as $idx => $pl) {
            $participantToPuuid[$idx + 1] = $pl['puuid'];
        }

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
