<?php

namespace App\Services\RiotApi;

use App\Models\MatchRecord;
use App\Models\MatchTimeline;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Riot Match-V5 API veri katmanı — DB-first mimarisi.
 *
 * Maç verileri kalıcı olarak MySQL'de saklanır (maçlar asla değişmez).
 * Akış: DB'de var mı? → Evet: DB'den oku (0 API isteği)
 *                      → Hayır: Riot API'den çek → DB'ye yaz → döndür
 */
class MatchDataService
{
    public const QUEUE_NAMES = [
        420 => 'SoloQ',
        440 => 'Flex',
        450 => 'ARAM',
        400 => 'Normal',
        430 => 'Blind',
        490 => 'Quickplay',
        700 => 'Clash',
        720 => 'ARAM Clash',
        830 => 'Bot (Kolay)',
        840 => 'Bot (Orta)',
        850 => 'Bot (Zor)',
        900 => 'URF',
        1020 => 'One for All',
        1300 => 'Nexus Blitz',
        1400 => 'Spellbook',
        1700 => 'Arena',
        1710 => 'Arena',
        1900 => 'Tam Gaz',
        2000 => 'Eğitim',
        2010 => 'Eğitim',
        2020 => 'Eğitim',
    ];

    private const SEASON_START_DAY = '01-08';

    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
    ) {}

    public function seasonStartTimestamp(): int
    {
        $year = (int) date('Y');
        $start = strtotime("{$year}-" . self::SEASON_START_DAY);
        if (time() < $start) {
            $start = strtotime(($year - 1) . '-' . self::SEASON_START_DAY);
        }
        return $start;
    }

    /**
     * Son N maçın ID'lerini getir (kısa cache — yeni maç kontrolü için).
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
     * Sezon ranked match ID'lerini cache'li çek.
     */
    public function getSeasonMatchIds(string $puuid, int $queueId): array
    {
        $cacheKey = "season_match_ids:v2:{$puuid}:{$queueId}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $queueId) {
            $seasonStart = $this->seasonStartTimestamp();
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['startTime' => $seasonStart, 'queue' => $queueId, 'count' => 100]
            );
        });
    }

    /**
     * Sezon başından bu yana TÜM queue'lardaki match ID'leri tek istekle çeker.
     * Queue filtrelemesi arama sırasında detay içindeki queueId üzerinden yapılır.
     */
    public function getAllSeasonMatchIds(string $puuid): array
    {
        $cacheKey = "season_match_ids:all:v1:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid) {
            $seasonStart = $this->seasonStartTimestamp();
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['startTime' => $seasonStart, 'count' => 100]
            );
        });
    }

    /**
     * Tek bir maçın detayını getir — DB-first.
     * DB'de varsa oradan okur (0 API isteği), yoksa API'den çekip DB'ye yazar.
     */
    public function getMatchDetail(string $matchId): array
    {
        // 1. DB'de var mı?
        $match = MatchRecord::find($matchId);
        if ($match) {
            return $match->data;
        }

        // 2. API'den çek
        $response = $this->api->regionRequest("/lol/match/v5/matches/{$matchId}");

        // 3. Sadece kullandığımız alanları çıkar ve DB'ye kaydet (~75KB → ~15KB)
        $slim = $this->extractMatchData($response);
        try {
            MatchRecord::create([
                'match_id'      => $matchId,
                'data'          => $slim,
                'queue_id'      => $slim['info']['queueId'] ?? 0,
                'game_duration' => $slim['info']['gameDuration'] ?? 0,
                'game_creation' => $slim['info']['gameCreation'] ?? 0,
            ]);
        } catch (\Exception $e) {}

        return $slim;
    }

    /**
     * Maç timeline verisi — DB-first.
     * DB'ye ham veri yerine sadece gerekli kısımları kaydeder (~1MB → ~10KB).
     * Dönüş formatı mevcut kodla uyumlu: ['info']['frames'][]['events'] + ['participantFrames']
     */
    /**
     * Timeline sadece DB'den oku — API'ye gitme. Yoksa null döner.
     */
    /**
     * Timeline sadece DB'den oku — API'ye gitme. Yoksa null döner.
     */
    public function getMatchTimelineIfExists(string $matchId): ?array
    {
        $timeline = MatchTimeline::find($matchId);
        return $timeline?->data;
    }

    /**
     * Maç detayı sadece DB'den oku — API'ye gitme. Yoksa null döner.
     */
    public function getMatchDetailIfExists(string $matchId): ?array
    {
        $match = MatchRecord::find($matchId);
        return $match?->data;
    }

    public function getMatchTimeline(string $matchId): ?array
    {
        // 1. DB'de var mı?
        $timeline = MatchTimeline::find($matchId);
        if ($timeline) {
            return $timeline->data;
        }

        // 2. API'den çek
        try {
            $response = $this->api->regionRequest("/lol/match/v5/matches/{$matchId}/timeline");
        } catch (\Exception $e) {
            return null;
        }

        // 3. Sadece gerekli verileri çıkar ve DB'ye kaydet
        $slim = $this->extractTimelineData($response);
        try {
            MatchTimeline::create([
                'match_id' => $matchId,
                'data'     => $slim,
            ]);
        } catch (\Exception $e) {}

        return $slim;
    }

    /**
     * Ham timeline verisinden sadece gerekli kısımları çıkar.
     * Kullanılan: ITEM_PURCHASED eventleri, SKILL_LEVEL_UP eventleri, participantFrames (gold)
     */
    private function extractTimelineData(array $raw): array
    {
        $frames = $raw['info']['frames'] ?? [];
        $slimFrames = [];

        foreach ($frames as $frame) {
            $slimFrame = [];

            // participantFrames — sadece totalGold (performance label için)
            if (isset($frame['participantFrames'])) {
                $pf = [];
                foreach ($frame['participantFrames'] as $pid => $data) {
                    $pf[$pid] = ['totalGold' => $data['totalGold'] ?? 0];
                }
                $slimFrame['participantFrames'] = $pf;
            }

            // Events — sadece ITEM_PURCHASED ve SKILL_LEVEL_UP
            $events = [];
            foreach ($frame['events'] ?? [] as $event) {
                $type = $event['type'] ?? '';
                if ($type === 'ITEM_PURCHASED') {
                    $events[] = [
                        'type'          => $type,
                        'timestamp'     => $event['timestamp'] ?? 0,
                        'participantId' => $event['participantId'] ?? null,
                        'itemId'        => $event['itemId'] ?? 0,
                    ];
                } elseif ($type === 'SKILL_LEVEL_UP') {
                    $events[] = [
                        'type'          => $type,
                        'timestamp'     => $event['timestamp'] ?? 0,
                        'participantId' => $event['participantId'] ?? null,
                        'skillSlot'     => $event['skillSlot'] ?? null,
                        'levelUpType'   => $event['levelUpType'] ?? 'NORMAL',
                    ];
                }
            }
            if (!empty($events)) {
                $slimFrame['events'] = $events;
            }

            $slimFrames[] = $slimFrame;
        }

        return ['info' => ['frames' => $slimFrames]];
    }

    /**
     * Ham maç verisinden sadece kullandığımız alanları çıkar.
     * Riot API ~150 alan/participant döner, biz ~40 kullanıyoruz.
     * ~75KB → ~15KB (%80 küçülme)
     */
    private function extractMatchData(array $raw): array
    {
        $info = $raw['info'] ?? [];

        $slimParticipants = array_map(function ($p) {
            return [
                'puuid' => $p['puuid'], 'summonerName' => $p['summonerName'] ?? '',
                'riotIdGameName' => $p['riotIdGameName'] ?? '', 'riotIdTagline' => $p['riotIdTagline'] ?? '',
                'championName' => $p['championName'], 'championId' => $p['championId'] ?? 0,
                'champLevel' => $p['champLevel'], 'teamId' => $p['teamId'],
                'teamPosition' => $p['teamPosition'] ?? '', 'individualPosition' => $p['individualPosition'] ?? '',
                'win' => $p['win'], 'kills' => $p['kills'], 'deaths' => $p['deaths'], 'assists' => $p['assists'],
                'totalMinionsKilled' => $p['totalMinionsKilled'] ?? 0, 'neutralMinionsKilled' => $p['neutralMinionsKilled'] ?? 0,
                'goldEarned' => $p['goldEarned'] ?? 0, 'totalDamageDealtToChampions' => $p['totalDamageDealtToChampions'] ?? 0,
                'physicalDamageDealtToChampions' => $p['physicalDamageDealtToChampions'] ?? 0,
                'magicDamageDealtToChampions' => $p['magicDamageDealtToChampions'] ?? 0,
                'trueDamageDealtToChampions' => $p['trueDamageDealtToChampions'] ?? 0,
                'totalDamageTaken' => $p['totalDamageTaken'] ?? 0,
                'totalHeal' => $p['totalHeal'] ?? 0,
                'totalHealsOnTeammates' => $p['totalHealsOnTeammates'] ?? 0,
                'totalDamageShieldedOnTeammates' => $p['totalDamageShieldedOnTeammates'] ?? 0,
                'visionScore' => $p['visionScore'] ?? 0, 'wardsPlaced' => $p['wardsPlaced'] ?? 0, 'wardsKilled' => $p['wardsKilled'] ?? 0,
                'damageDealtToTurrets' => $p['damageDealtToTurrets'] ?? 0, 'damageDealtToObjectives' => $p['damageDealtToObjectives'] ?? 0,
                'summoner1Id' => $p['summoner1Id'] ?? 0, 'summoner2Id' => $p['summoner2Id'] ?? 0,
                'perks' => $p['perks'] ?? null, 'profileIcon' => $p['profileIcon'] ?? 0, 'summonerLevel' => $p['summonerLevel'] ?? 0,
                'item0' => $p['item0'] ?? 0, 'item1' => $p['item1'] ?? 0, 'item2' => $p['item2'] ?? 0,
                'item3' => $p['item3'] ?? 0, 'item4' => $p['item4'] ?? 0, 'item5' => $p['item5'] ?? 0, 'item6' => $p['item6'] ?? 0,
                'doubleKills' => $p['doubleKills'] ?? 0, 'tripleKills' => $p['tripleKills'] ?? 0,
                'quadraKills' => $p['quadraKills'] ?? 0, 'pentaKills' => $p['pentaKills'] ?? 0,
                'timeCCingOthers' => $p['timeCCingOthers'] ?? 0, // ELW CC bonusu (engage/peel)
                // Spell casts (Q/W/E/R + D/F) — Detaylar sekmesi "Spell Casted"
                'spell1Casts' => $p['spell1Casts'] ?? 0, 'spell2Casts' => $p['spell2Casts'] ?? 0,
                'spell3Casts' => $p['spell3Casts'] ?? 0, 'spell4Casts' => $p['spell4Casts'] ?? 0,
                'summoner1Casts' => $p['summoner1Casts'] ?? 0, 'summoner2Casts' => $p['summoner2Casts'] ?? 0,
                // Pings (Riot alan adları korunur — frontend PING_LABELS bunlarla eşler)
                'onMyWayPings' => $p['onMyWayPings'] ?? 0, 'enemyMissingPings' => $p['enemyMissingPings'] ?? 0,
                'assistMePings' => $p['assistMePings'] ?? 0, 'needVisionPings' => $p['needVisionPings'] ?? 0,
                'getBackPings' => $p['getBackPings'] ?? 0, 'pushPings' => $p['pushPings'] ?? 0,
                'allInPings' => $p['allInPings'] ?? 0, 'holdPings' => $p['holdPings'] ?? 0,
                'dangerPings' => $p['dangerPings'] ?? 0, 'commandPings' => $p['commandPings'] ?? 0,
                'enemyVisionPings' => $p['enemyVisionPings'] ?? 0, 'visionClearedPings' => $p['visionClearedPings'] ?? 0,
                'baitPings' => $p['baitPings'] ?? 0, 'basicPings' => $p['basicPings'] ?? 0,
                'challenges' => [
                    'soloKills' => $p['challenges']['soloKills'] ?? 0,
                    'damagePerMinute' => $p['challenges']['damagePerMinute'] ?? 0,
                    'goldPerMinute' => $p['challenges']['goldPerMinute'] ?? 0,
                    'killParticipation' => $p['challenges']['killParticipation'] ?? 0,
                    'visionScorePerMinute' => $p['challenges']['visionScorePerMinute'] ?? 0,
                    'turretPlatesTaken' => $p['challenges']['turretPlatesTaken'] ?? 0,
                    'teamDamagePercentage' => $p['challenges']['teamDamagePercentage'] ?? 0,
                    'damageTakenOnTeamPercentage' => $p['challenges']['damageTakenOnTeamPercentage'] ?? 0,
                    'epicMonsterSteals' => $p['challenges']['epicMonsterSteals'] ?? 0,
                    'skillshotsHit' => $p['challenges']['skillshotsHit'] ?? 0,
                    'skillshotsDodged' => $p['challenges']['skillshotsDodged'] ?? 0,
                    'laneMinionsFirst10Minutes' => $p['challenges']['laneMinionsFirst10Minutes'] ?? 0,
                    'maxCsAdvantageOnLaneOpponent' => $p['challenges']['maxCsAdvantageOnLaneOpponent'] ?? 0,
                    'firstBloodKill' => $p['firstBloodKill'] ?? false,  // top-düzey: challenges.firstBloodKill Riot'ta güvenilmez (hep false)
                    'firstTowerKill' => $p['challenges']['firstTowerKill'] ?? false,
                    'controlWardsPlaced' => $p['challenges']['controlWardsPlaced'] ?? 0,
                    'survivedSingleDigitHpCount' => $p['challenges']['survivedSingleDigitHpCount'] ?? 0,
                    'outnumberedKills' => $p['challenges']['outnumberedKills'] ?? 0,
                    'dragonTakedowns' => $p['challenges']['dragonTakedowns'] ?? 0,
                    'baronTakedowns' => $p['challenges']['baronTakedowns'] ?? 0,
                    'riftHeraldTakedowns' => $p['challenges']['riftHeraldTakedowns'] ?? 0,
                    // ELW #7 (2026-06-30) — destek + genel granül metrikler (SKOR) + rozet alanları.
                    // Eski maçlarda yok → 0 gelir (worker yeniden çektikçe dolar).
                    'wardTakedowns' => $p['challenges']['wardTakedowns'] ?? 0,                       // "wards killed"
                    'stealthWardsPlaced' => $p['challenges']['stealthWardsPlaced'] ?? 0,             // "wards placed"
                    'pickKillWithAlly' => $p['challenges']['pickKillWithAlly'] ?? 0,                 // koordineli pick kill
                    'saveAllyFromDeath' => $p['challenges']['saveAllyFromDeath'] ?? 0,               // clutch peel
                    'effectiveHealAndShielding' => $p['challenges']['effectiveHealAndShielding'] ?? 0, // overheal hariç
                    'enemyChampionImmobilizations' => $p['challenges']['enemyChampionImmobilizations'] ?? 0, // CC adedi
                    'visionScoreAdvantageLaneOpponent' => $p['challenges']['visionScoreAdvantageLaneOpponent'] ?? 0,
                    'voidMonsterKill' => $p['challenges']['voidMonsterKill'] ?? 0,                   // grublar
                    'turretTakedowns' => $p['challenges']['turretTakedowns'] ?? 0,                   // kule katkısı
                    'killsNearEnemyTurret' => $p['challenges']['killsNearEnemyTurret'] ?? 0,         // agresif dalış
                    'earlyLaningPhaseGoldExpAdvantage' => $p['challenges']['earlyLaningPhaseGoldExpAdvantage'] ?? 0,
                    'laningPhaseGoldExpAdvantage' => $p['challenges']['laningPhaseGoldExpAdvantage'] ?? 0,
                    'jungleCsBefore10Minutes' => $p['challenges']['jungleCsBefore10Minutes'] ?? 0,
                    'enemyJungleMonsterKills' => $p['challenges']['enemyJungleMonsterKills'] ?? 0,   // counter-jungle
                    'killsOnLanersEarlyJungleAsJungler' => $p['challenges']['killsOnLanersEarlyJungleAsJungler'] ?? 0,
                    'killsOnOtherLanesEarlyJungleAsLaner' => $p['challenges']['killsOnOtherLanesEarlyJungleAsLaner'] ?? 0,
                    'buffsStolen' => $p['challenges']['buffsStolen'] ?? 0,
                    'killsWithHelpFromEpicMonster' => $p['challenges']['killsWithHelpFromEpicMonster'] ?? 0,
                    // ROZET alanları (skora girmez)
                    'multiKillOneSpell' => $p['challenges']['multiKillOneSpell'] ?? 0,
                    'highestWardKills' => $p['challenges']['highestWardKills'] ?? 0,
                    'hadOpenNexus' => $p['challenges']['hadOpenNexus'] ?? 0,
                    'killedChampTookFullTeamDamageSurvived' => $p['challenges']['killedChampTookFullTeamDamageSurvived'] ?? 0,
                    'outnumberedKills' => $p['challenges']['outnumberedKills'] ?? 0,
                ],
                'missions' => $p['missions'] ?? null,
            ];
        }, $info['participants'] ?? []);

        return [
            'metadata' => $raw['metadata'] ?? [],
            'info' => [
                'queueId' => $info['queueId'] ?? 0,
                'gameVersion' => $info['gameVersion'] ?? '', // patch bucketing (meta istatistik) için ŞART
                'gameDuration' => $info['gameDuration'] ?? 0,
                'gameCreation' => $info['gameCreation'] ?? 0,
                'teams' => $info['teams'] ?? [],
                'participants' => $slimParticipants,
            ],
        ];
    }

    /**
     * Birden fazla maç detayını paralel olarak çek ve DB'ye yaz.
     * DB'de olmayanları Http::pool() ile eşzamanlı indirir.
     */
    public function preloadMatches(array $matchIds): void
    {
        $this->preloadMatchDetails($matchIds);
        $this->preloadMatchTimelines($matchIds);
    }

    /**
     * Sadece maç detaylarını paralel yükle (timeline olmadan).
     */
    public function preloadMatchDetails(array $matchIds): void
    {
        // DB'de olmayan maçları bul
        $existing = MatchRecord::whereIn('match_id', $matchIds)->pluck('match_id')->toArray();
        $missing = array_values(array_diff($matchIds, $existing));

        if (empty($missing)) return;

        $regionUrl = config('riot.region_url');
        $apiKey = config('riot.api_key');

        foreach (array_chunk($missing, 20) as $chunk) {
            // Cooldown aktifse bu chunk'ı atla
            $cooldown = Cache::get('riot:rate_limit_cooldown');
            if ($cooldown && time() < $cooldown) break;

            $responses = Http::pool(function ($pool) use ($chunk, $regionUrl, $apiKey) {
                foreach ($chunk as $id) {
                    $pool->as($id)
                        ->timeout(10)
                        ->withHeaders(['X-Riot-Token' => $apiKey])
                        ->get("{$regionUrl}/lol/match/v5/matches/{$id}");
                }
            });

            foreach ($chunk as $id) {
                $resp = $responses[$id] ?? null;
                if (!$resp) continue;

                // Pool'da 429 gelirse cooldown ayarla ve kalan chunk'ları atla
                if (RiotApiService::handlePoolRateLimit($resp)) break 2;

                if ($resp->successful()) {
                    $slim = $this->extractMatchData($resp->json());
                    try {
                        MatchRecord::create([
                            'match_id'      => $id,
                            'data'          => $slim,
                            'queue_id'      => $slim['info']['queueId'] ?? 0,
                            'game_duration' => $slim['info']['gameDuration'] ?? 0,
                            'game_creation' => $slim['info']['gameCreation'] ?? 0,
                        ]);
                    } catch (\Exception $e) {}
                }
            }
        }
    }

    /**
     * Maç detaylarını getir ama API'den geleni matches'e YAZMA (geçici).
     * DB'de varsa oradan (0 API), yoksa API'den (paralel). match_summaries kurulumu
     * için: full 10-oyuncu maçı saklamadan özet hesaplanır → matches yalnız tıklanınca büyür.
     *
     * @return array<string, array> matchId => slim detail (bulunamayan/başarısız atlanır)
     */
    public function getMatchDetailsTransient(array $matchIds): array
    {
        $out = [];
        if (empty($matchIds)) return $out;

        // 1. DB'de olan tam maçlar (mevcut kayıtlar) — 0 API isteği.
        $rows = MatchRecord::whereIn('match_id', $matchIds)->get(['match_id', 'data']);
        foreach ($rows as $row) {
            $out[$row->match_id] = $row->data;
        }

        // 2. Eksikler → API (paralel), ama matches'e YAZMA.
        $missing = array_values(array_diff($matchIds, array_keys($out)));
        if (empty($missing)) return $out;

        $regionUrl = config('riot.region_url');
        $apiKey = config('riot.api_key');

        foreach (array_chunk($missing, 20) as $chunk) {
            $cooldown = Cache::get('riot:rate_limit_cooldown');
            if ($cooldown && time() < $cooldown) break;

            $responses = Http::pool(function ($pool) use ($chunk, $regionUrl, $apiKey) {
                foreach ($chunk as $id) {
                    $pool->as($id)
                        ->timeout(10)
                        ->withHeaders(['X-Riot-Token' => $apiKey])
                        ->get("{$regionUrl}/lol/match/v5/matches/{$id}");
                }
            });

            foreach ($chunk as $id) {
                $resp = $responses[$id] ?? null;
                if (!$resp) continue;
                if (RiotApiService::handlePoolRateLimit($resp)) break 2;
                if ($resp->successful()) {
                    $out[$id] = $this->extractMatchData($resp->json()); // YAZMA YOK
                }
            }
        }

        return $out;
    }

    /**
     * Sadece timeline'ları paralel yükle.
     */
    public function preloadMatchTimelines(array $matchIds): void
    {
        $existing = MatchTimeline::whereIn('match_id', $matchIds)->pluck('match_id')->toArray();
        $missing = array_values(array_diff($matchIds, $existing));

        if (empty($missing)) return;

        $regionUrl = config('riot.region_url');
        $apiKey = config('riot.api_key');

        foreach (array_chunk($missing, 20) as $chunk) {
            $cooldown = Cache::get('riot:rate_limit_cooldown');
            if ($cooldown && time() < $cooldown) break;

            $responses = Http::pool(function ($pool) use ($chunk, $regionUrl, $apiKey) {
                foreach ($chunk as $id) {
                    $pool->as($id)
                        ->timeout(10)
                        ->withHeaders(['X-Riot-Token' => $apiKey])
                        ->get("{$regionUrl}/lol/match/v5/matches/{$id}/timeline");
                }
            });

            foreach ($chunk as $id) {
                $resp = $responses[$id] ?? null;
                if (!$resp) continue;

                if (RiotApiService::handlePoolRateLimit($resp)) break 2;

                if ($resp->successful()) {
                    try {
                        MatchTimeline::create([
                            'match_id' => $id,
                            'data'     => $this->extractTimelineData($resp->json()),
                        ]);
                    } catch (\Exception $e) {}
                }
            }
        }
    }

    /**
     * Champion ID'den görsel URL'i bul.
     */
    public function getChampImageById(int $championId): ?string
    {
        $champions = $this->ddragon->getChampions();
        foreach ($champions as $champ) {
            if ((int) $champ['key'] === $championId) {
                return $this->ddragon->championIconUrl($champ['id']);
            }
        }
        return null;
    }
}
