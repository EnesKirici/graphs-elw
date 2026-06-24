<?php

namespace App\Services\RiotApi;

use App\Models\CachedPlayer;
use App\Models\MatchSummary;
use Illuminate\Support\Facades\Log;

/**
 * Maç geçmişi orkestratör servisi.
 *
 * Alt servisleri koordine ederek SummonerController'a veri sunar.
 * Kendi iş mantığı yoktur — sadece birleştirir.
 */
class MatchService
{
    /** ELW/badge algoritması değişince bump → eski match_summaries yeniden kurulur. */
    private const ALGO_VERSION = 1;

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
                'spellCasts'     => [
                    'q' => $p['spell1Casts'] ?? 0,
                    'w' => $p['spell2Casts'] ?? 0,
                    'e' => $p['spell3Casts'] ?? 0,
                    'r' => $p['spell4Casts'] ?? 0,
                ],
                'summonerCasts'  => [
                    'd' => $p['summoner1Casts'] ?? 0, // 1. sihirdar büyüsü (D)
                    'f' => $p['summoner2Casts'] ?? 0, // 2. sihirdar büyüsü (F)
                ],
                'pings'          => [
                    'onMyWayPings'       => $p['onMyWayPings'] ?? 0,
                    'enemyMissingPings'  => $p['enemyMissingPings'] ?? 0,
                    'assistMePings'      => $p['assistMePings'] ?? 0,
                    'needVisionPings'    => $p['needVisionPings'] ?? 0,
                    'getBackPings'       => $p['getBackPings'] ?? 0,
                    'pushPings'          => $p['pushPings'] ?? 0,
                    'allInPings'         => $p['allInPings'] ?? 0,
                    'holdPings'          => $p['holdPings'] ?? 0,
                    'dangerPings'        => $p['dangerPings'] ?? 0,
                    'commandPings'       => $p['commandPings'] ?? 0,
                    'enemyVisionPings'   => $p['enemyVisionPings'] ?? 0,
                    'visionClearedPings' => $p['visionClearedPings'] ?? 0,
                    'baitPings'          => $p['baitPings'] ?? 0,
                    'basicPings'         => $p['basicPings'] ?? 0,
                ],
                'badges'         => $this->badges->calculateBadges($p, $info),
                'tier'           => null,
                'rankDivision'   => null,
                'leaguePoints'   => null, // Master+ LP gösterimi için
            ];
        }

        // Rank bilgisi
        foreach ($players as &$pl) {
            try {
                $ranked = $this->league->getRankedInfo($pl['puuid']);
                if ($ranked['solo'] ?? null) {
                    $pl['tier'] = $ranked['solo']['tier'];
                    $pl['rankDivision'] = $ranked['solo']['rank'];
                    $pl['leaguePoints'] = $ranked['solo']['lp'] ?? null;
                }
            } catch (\Exception $e) {
                // Sessizce yutma — rank null kalırsa (key expire/rate-limit) sebebi görünsün.
                Log::warning('match detail rank fetch failed', ['puuid' => $pl['puuid'], 'err' => $e->getMessage()]);
            }
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
        if (empty($matchIds)) return [];

        // 1. Önceden hesaplanmış özetler (DB-first, bu algo versiyonu) → liste hızlı.
        $cached = MatchSummary::where('puuid', $puuid)
            ->whereIn('match_id', $matchIds)
            ->where('algorithm_version', self::ALGO_VERSION)
            ->get()
            ->keyBy('match_id');

        // 2. Eksikler için full maçı TRANSIENT çek (matches'e YAZMADAN), özet kur + sakla.
        $missing = array_values(array_filter($matchIds, fn($id) => !$cached->has($id)));
        $details = $missing ? $this->matchData->getMatchDetailsTransient($missing) : [];
        $ctx = $details ? $this->summaryContext() : [];

        // 3. matchIds sırasıyla (yeni→eski) özetleri topla.
        $matches = [];
        foreach ($matchIds as $matchId) {
            if ($cached->has($matchId)) {
                $matches[] = $cached[$matchId]->summary_json;
                continue;
            }
            $detail = $details[$matchId] ?? null;
            if (!$detail) continue;
            try {
                $summary = $this->buildMatchSummary($detail, $puuid, $matchId, $ctx);
            } catch (\Exception $e) {
                continue;
            }
            if (!$summary) continue;

            $stat = $this->buildStatPayload($detail['info'] ?? [], $puuid);
            $this->persistSummary($matchId, $puuid, $detail['info'] ?? [], $summary, $stat);
            $matches[] = $summary;
        }

        // Autocomplete: yalnız yeni çekilen maçlardaki oyuncuları kaydet.
        $this->cachePlayersFromDetails($details);

        return $matches;
    }

    /**
     * Bir oyuncunun TÜM sezon maçlarının özetini (display + stat) garanti et.
     * Eksikleri transient çeker (matches'e YAZMADAN) + kurar + match_summaries'e yazar.
     * Profil açılışında BİR KEZ çağrılır; 8 season-stat metodu da aynı havuzdan okur
     * → full maç saklanmaz, maç 8 kez taranmaz. (Eski toplu preload'un yerini alır.)
     */
    public function ensureSeasonSummaries(string $puuid): array
    {
        $matchIds = [];
        foreach ([420, 440, 400, 430, 490] as $queueId) {
            try {
                $matchIds = array_merge($matchIds, $this->matchData->getSeasonMatchIds($puuid, $queueId));
            } catch (\Exception $e) {}
        }
        $matchIds = array_values(array_unique($matchIds));
        if (empty($matchIds)) return [];

        // Bu algo versiyonunda + stat_json dolu olanlar hazır; gerisi eksik.
        $have = MatchSummary::where('puuid', $puuid)
            ->whereIn('match_id', $matchIds)
            ->where('algorithm_version', self::ALGO_VERSION)
            ->whereNotNull('stat_json')
            ->pluck('match_id')
            ->all();
        $missing = array_values(array_diff($matchIds, $have));
        if (empty($missing)) return $matchIds;

        $details = $this->matchData->getMatchDetailsTransient($missing);
        if (empty($details)) return $matchIds;
        $ctx = $this->summaryContext();

        foreach ($missing as $matchId) {
            $detail = $details[$matchId] ?? null;
            if (!$detail) continue;
            try {
                $summary = $this->buildMatchSummary($detail, $puuid, $matchId, $ctx);
                $stat = $this->buildStatPayload($detail['info'] ?? [], $puuid);
                if (!$summary || !$stat) continue;
                $this->persistSummary($matchId, $puuid, $detail['info'] ?? [], $summary, $stat);
            } catch (\Exception $e) {}
        }

        $this->cachePlayersFromDetails($details);

        return $matchIds;
    }

    /** Bir maç özetini match_summaries'e yaz (match_id+puuid unique). */
    private function persistSummary(string $matchId, string $puuid, array $info, array $summary, ?array $stat): void
    {
        try {
            MatchSummary::updateOrCreate(
                ['match_id' => $matchId, 'puuid' => $puuid],
                [
                    'queue_id'          => $info['queueId'] ?? 0,
                    'game_creation'     => $info['gameCreation'] ?? 0,
                    'win'               => $summary['win'] ?? false,
                    'summary_json'      => $summary,
                    'stat_json'         => $stat,
                    'algorithm_version' => self::ALGO_VERSION,
                ],
            );
        } catch (\Exception $e) {}
    }

    /**
     * Season-stat metotları için kompakt veri: aranan oyuncunun HAM participant'ı
     * (challenges dahil) + maçtaki 10 oyuncunun kompakt kimliği (duo/avg-rank) + meta.
     * Full 10-oyuncu maçı saklamadan tüm sezon istatistikleri buradan hesaplanır.
     */
    private function buildStatPayload(array $info, string $puuid): ?array
    {
        $player = null;
        foreach ($info['participants'] ?? [] as $p) {
            if (($p['puuid'] ?? null) === $puuid) { $player = $p; break; }
        }
        if (!$player) return null;

        $roster = [];
        foreach ($info['participants'] as $p) {
            $roster[] = [
                'puuid'        => $p['puuid'] ?? '',
                'gameName'     => $p['riotIdGameName'] ?? $p['summonerName'] ?? '',
                'tagLine'      => $p['riotIdTagline'] ?? '',
                'profileIcon'  => $p['profileIcon'] ?? null,
                'championName' => $p['championName'] ?? '',
                'teamId'       => $p['teamId'] ?? 0,
                'position'     => $p['teamPosition'] ?? '',
            ];
        }

        return [
            'p'            => $player,
            'roster'       => $roster,
            'gameDuration' => $info['gameDuration'] ?? 0,
            'gameCreation' => $info['gameCreation'] ?? 0,
            'queueId'      => $info['queueId'] ?? 0,
        ];
    }

    /** Özet kurulumu için ortak DataDragon bağlamı (maç başına yeniden çekilmesin). */
    private function summaryContext(): array
    {
        return [
            'version'     => $this->ddragon->getCurrentVersion(),
            'ddragonBase' => config('riot.ddragon_url'),
            'runeMap'     => $this->ddragon->getRuneMap(),
            'spellMap'    => $this->ddragon->getSpellMap(),
            'allItems'    => $this->ddragon->getItems(),
        ];
    }

    /**
     * Tek maçın aranan oyuncuya ait özetini kur — odaklı servislere DELEGE eder:
     * sıralama/perfLabel/ELW→ElwScoreService, eşya→buildPlayerItems, rün→Formatter,
     * badge→BadgeService, koridor/takım→LaneAnalysisService. (Eski dev inline blok bölündü.)
     */
    private function buildMatchSummary(array $detail, string $puuid, string $matchId, array $ctx): ?array
    {
        $info = $detail['info'];

        $player = null;
        foreach ($info['participants'] as $p) {
            if ($p['puuid'] === $puuid) { $player = $p; break; }
        }
        if (!$player) return null;

        $duration = $info['gameDuration'] ?? 0;

        // Sıralama + performans etiketi (ELW servisi)
        $ranking = $this->elw->calculateMatchRanking($info['participants'], $puuid, $duration);
        $timeline = $this->matchData->getMatchTimelineIfExists($matchId);
        $perfLabel = $this->elw->calculatePerformanceLabel($ranking, $player, $info, $timeline);

        // Eşya / büyü / rün
        $items = $this->buildPlayerItems($player, $ctx['allItems'], $ctx['version'], $ctx['ddragonBase']);
        $spells = [
            $ctx['spellMap'][$player['summoner1Id'] ?? 0] ?? ['name' => '?', 'image' => ''],
            $ctx['spellMap'][$player['summoner2Id'] ?? 0] ?? ['name' => '?', 'image' => ''],
        ];
        $runes = $this->formatter->extractRunes($player['perks'] ?? null, $ctx['runeMap']);

        // Dost/düşman kadroları + koridor/takım analizi (LaneAnalysisService)
        [$allies, $enemies] = $this->buildRosters($info, $puuid, $player['teamId']);
        $teamScores = $this->elw->calculateAllElwScores($info['participants'], $duration, 'team');
        $lane = $this->laneAnalysis->summarizeForPlayer($info, $player, $puuid, $teamScores);

        $role = $player['teamPosition'] ?: $player['individualPosition'] ?: '';
        $role = $role === 'BOT' ? 'BOTTOM' : $role;

        return [
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
            'duration'     => $duration,
            'queueType'    => MatchDataService::QUEUE_NAMES[$info['queueId'] ?? 0] ?? 'Diğer',
            'role'         => $role,
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
            // Koridor/takım (LaneAnalysisService::summarizeForPlayer)
            'laneOpponent' => $lane['laneOpponent'],
            'laneDuo'      => $lane['laneDuo'],
            'enemyDuo'     => $lane['enemyDuo'],
            'partnerRole'  => $lane['partnerRole'],
            'teamQuality'  => $lane['teamQuality'],
            'kp'           => $lane['kp'],
            'csPerMin'     => $lane['csPerMin'],
            'csDiff'       => $lane['csDiff'],
        ];
    }

    /** Maçtaki dost/düşman şampiyon kadroları (aranan oyuncunun takımına göre). */
    private function buildRosters(array $info, string $puuid, int $playerTeam): array
    {
        $allies = [];
        $enemies = [];
        foreach ($info['participants'] as $p) {
            $entry = [
                'name'     => $p['championName'],
                'image'    => $this->ddragon->championIconUrl($p['championName']),
                'isMe'     => $p['puuid'] === $puuid,
                'gameName' => $p['riotIdGameName'] ?? $p['summonerName'] ?? '?',
                'tagLine'  => $p['riotIdTagline'] ?? '',
            ];
            if ($p['teamId'] === $playerTeam) {
                $allies[] = $entry;
            } else {
                $enemies[] = $entry;
            }
        }

        return [$allies, $enemies];
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
     * Zaten çekilmiş maç detaylarındaki oyuncuları autocomplete için kaydet.
     * getRecentMatches transient detayları buraya verir → tekrar API/getMatchDetail YOK.
     */
    private function cachePlayersFromDetails(array $details): void
    {
        try {
            $seen = [];
            foreach ($details as $detail) {
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
