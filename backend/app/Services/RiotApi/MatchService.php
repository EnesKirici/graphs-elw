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

    // Riot sezonu her yıl ~8 Ocak'ta başlar
    private const SEASON_START_DAY = '01-08';

    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
        private LeagueService $league,
    ) {}

    /**
     * Mevcut sezonun başlangıç timestamp'ini döner.
     * 8 Ocak'tan önceyse önceki yılın sezonunu kullanır.
     */
    private function seasonStartTimestamp(): int
    {
        $year = (int) date('Y');
        $start = strtotime("{$year}-" . self::SEASON_START_DAY);

        // Henüz bu yılın sezon başlangıcına gelmediyse önceki yılı kullan
        if (time() < $start) {
            $start = strtotime(($year - 1) . '-' . self::SEASON_START_DAY);
        }

        return $start;
    }

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
                'teamHealing'    => ($p['totalHealsOnTeammates'] ?? 0) + ($p['totalDamageShieldedOnTeammates'] ?? 0),
                'visionScore'    => $p['visionScore'] ?? 0,
                'wardsPlaced'    => $p['wardsPlaced'] ?? 0,
                'wardsKilled'    => $p['wardsKilled'] ?? 0,
                'towerDamage'    => $p['damageDealtToTurrets'] ?? 0,
                'objectiveDamage'=> $p['damageDealtToObjectives'] ?? 0,
                'items'          => $items,
                'spells'         => [$spell1, $spell2],
                'runes'          => $runes,
                'role'           => ($p['teamPosition'] ?: $p['individualPosition'] ?: '') === 'BOT' ? 'BOTTOM' : ($p['teamPosition'] ?: $p['individualPosition'] ?: ''),
                'doubleKills'    => $p['doubleKills'] ?? 0,
                'tripleKills'    => $p['tripleKills'] ?? 0,
                'quadraKills'    => $p['quadraKills'] ?? 0,
                'pentaKills'     => $p['pentaKills'] ?? 0,
                'badges'         => $this->calculateBadges($p, $info),
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

        // Lane analysis — rol bazlı karşılaştırma
        $laneAnalysis = $this->buildLaneAnalysis($team100, $team200, $info['gameDuration']);

        return [
            'matchId'      => $matchId,
            'queueType'    => self::QUEUE_NAMES[$info['queueId'] ?? 0] ?? 'Diğer',
            'duration'     => $info['gameDuration'],
            'gameCreation' => $info['gameCreation'],
            'teams'        => [
                ['info' => $teams[100] ?? null, 'players' => $team100],
                ['info' => $teams[200] ?? null, 'players' => $team200],
            ],
            'laneAnalysis' => $laneAnalysis,
        ];
    }

    /**
     * Koridor bazlı analiz — iki takımın aynı roldeki oyuncularını karşılaştırır.
     *
     * Hesaplama mantığı (rol bazlı ağırlıklar):
     *   Her metrik normalize edilir (-1 ile +1 arası) ve rol ağırlığıyla çarpılır.
     *   Pozitif skor = mavi üstün, negatif = kırmızı üstün.
     *
     * Metrikler (9 adet):
     *   KDA        — (kills+assists)/deaths farkı, tüm roller için temel
     *   CS         — CS farkı / dakika, farm yapan roller için önemli
     *   Gold       — Toplam gold farkı, genel güç göstergesi
     *   Hasar      — Şampiyonlara verilen hasar farkı
     *   AlınanHasar— Tanklar (top/jg) için pozitif (soak), carry'ler için negatif
     *   KuleHasarı — Kule hasarı farkı, split-push/lane pressure göstergesi
     *   ObjHasarı  — Objective hasar (JUNGLE için ağırlıklı: ejder/baron/rift)
     *   Görüş      — Vision score + ward placed + ward killed birleşik
     *   İyileştirme— Takım arkadaşlarına iyileştirme + kalkan (healer/enchanter sup)
     */
    private function buildLaneAnalysis(array $team100, array $team200, int $duration): array
    {
        $roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
        $roleLabels = [
            'TOP' => 'Top', 'JUNGLE' => 'Orman', 'MIDDLE' => 'Orta',
            'BOTTOM' => 'Alt', 'UTILITY' => 'Destek',
        ];

        // Rol bazlı ağırlık tablosu (9 metrik)
        // İyileştirme = totalHealsOnTeammates + totalDamageShieldedOnTeammates
        // Görüş = visionScore (%60) + wardPlaced+wardKilled (%40) birleşik
        $weights = [
            'TOP' => [
                'kda' => 3.0, 'cs' => 2.5, 'gold' => 2.0, 'damage' => 2.5,
                'damageTaken' => 1.5, 'towerDmg' => 2.0, 'objDmg' => 0.5,
                'vision' => 1.5, 'healing' => 0.5,
            ],
            'JUNGLE' => [
                'kda' => 3.0, 'cs' => 1.5, 'gold' => 2.0, 'damage' => 2.0,
                'damageTaken' => 1.0, 'towerDmg' => 1.0, 'objDmg' => 3.5,
                'vision' => 2.5, 'healing' => 0.5,
            ],
            'MIDDLE' => [
                'kda' => 3.0, 'cs' => 2.5, 'gold' => 2.0, 'damage' => 3.0,
                'damageTaken' => 0.5, 'towerDmg' => 1.5, 'objDmg' => 0.5,
                'vision' => 1.5, 'healing' => 0.5,
            ],
            'BOTTOM' => [
                'kda' => 3.0, 'cs' => 3.0, 'gold' => 2.5, 'damage' => 3.5,
                'damageTaken' => 0.5, 'towerDmg' => 1.5, 'objDmg' => 0.5,
                'vision' => 1.5, 'healing' => 0.5,
            ],
            'UTILITY' => [
                'kda' => 3.0, 'cs' => 0.0, 'gold' => 1.0, 'damage' => 1.0,
                'damageTaken' => 2.5, 'towerDmg' => 0.5, 'objDmg' => 0.5,
                'vision' => 3.5, 'healing' => 2.5,
            ],
        ];

        $analysis = [];
        $minutes = max($duration / 60, 1);

        foreach ($roles as $role) {
            $blue = null;
            $red  = null;
            foreach ($team100 as $p) {
                if ($p['role'] === $role) { $blue = $p; break; }
            }
            foreach ($team200 as $p) {
                if ($p['role'] === $role) { $red = $p; break; }
            }
            if (!$blue || !$red) continue;

            $w = $weights[$role];

            // Her metriği hesapla — farkı normalize et
            $factors = [];
            $score = 0;

            // KDA
            $bKda = $blue['deaths'] > 0 ? ($blue['kills'] + $blue['assists']) / $blue['deaths'] : ($blue['kills'] + $blue['assists']);
            $rKda = $red['deaths'] > 0 ? ($red['kills'] + $red['assists']) / $red['deaths'] : ($red['kills'] + $red['assists']);
            $kdaDiff = $bKda - $rKda;
            $kdaScore = max(-1, min(1, $kdaDiff / 3)) * $w['kda'];
            $score += $kdaScore;
            if (abs($kdaScore) > 0.5) $factors[] = ['metric' => 'KDA', 'value' => round($kdaScore, 1)];

            // CS
            $csDiff = $blue['cs'] - $red['cs'];
            $csNorm = max(-1, min(1, ($csDiff / $minutes) / 3));
            $csScore = $csNorm * $w['cs'];
            $score += $csScore;
            if (abs($csScore) > 0.5) $factors[] = ['metric' => 'CS', 'value' => round($csScore, 1)];

            // Gold
            $goldDiff = $blue['gold'] - $red['gold'];
            $goldNorm = max(-1, min(1, $goldDiff / 4000));
            $goldScore = $goldNorm * $w['gold'];
            $score += $goldScore;
            if (abs($goldScore) > 0.5) $factors[] = ['metric' => 'Gold', 'value' => round($goldScore, 1)];

            // Verilen hasar
            $dmgDiff = $blue['damage'] - $red['damage'];
            $dmgNorm = max(-1, min(1, $dmgDiff / 8000));
            $dmgScore = $dmgNorm * $w['damage'];
            $score += $dmgScore;
            if (abs($dmgScore) > 0.5) $factors[] = ['metric' => 'Hasar', 'value' => round($dmgScore, 1)];

            // Alınan hasar:
            //   Top/JG: fazla almak iyi (tank/soak/frontline)
            //   Mid/ADC: az almak iyi (carry pozisyonlama)
            //   Support: karşılaştırmalı — iki support'un farkı alınır, kim daha
            //   fazla aldıysa o "daha aktif" sayılır. Tank sup doğal olarak fazla alır,
            //   healer sup az alır ama iyileştirme metriğinden puan alır. Eşit ağırlık (2.5).
            $dtDiff = ($blue['damageTaken'] ?? 0) - ($red['damageTaken'] ?? 0);
            if (in_array($role, ['TOP', 'JUNGLE', 'UTILITY'])) {
                // Tank/frontline/engage rolleri: daha fazla hasar almak iyi
                $dtNorm = max(-1, min(1, $dtDiff / 10000));
            } else {
                // Carry rolleri: daha az hasar almak iyi
                $dtNorm = max(-1, min(1, -$dtDiff / 10000));
            }
            $dtScore = $dtNorm * $w['damageTaken'];
            $score += $dtScore;
            if (abs($dtScore) > 0.3) $factors[] = ['metric' => 'Alınan Hasar', 'value' => round($dtScore, 1)];

            // Kule hasarı
            $twrDiff = ($blue['towerDamage'] ?? 0) - ($red['towerDamage'] ?? 0);
            $twrNorm = max(-1, min(1, $twrDiff / 5000));
            $twrScore = $twrNorm * $w['towerDmg'];
            $score += $twrScore;
            if (abs($twrScore) > 0.3) $factors[] = ['metric' => 'Kule Hasarı', 'value' => round($twrScore, 1)];

            // Objective hasarı
            $objDiff = ($blue['objectiveDamage'] ?? 0) - ($red['objectiveDamage'] ?? 0);
            $objNorm = max(-1, min(1, $objDiff / 15000));
            $objScore = $objNorm * $w['objDmg'];
            $score += $objScore;
            if (abs($objScore) > 0.3) $factors[] = ['metric' => 'Obj. Hasarı', 'value' => round($objScore, 1)];

            // Görüş (birleşik: vision score %60 + ward activity %40)
            // Support/Jungle için normalize böleni daha düşük → küçük farklar bile etkili
            $bVis = ($blue['visionScore'] ?? 0);
            $rVis = ($red['visionScore'] ?? 0);
            $bWards = ($blue['wardsPlaced'] ?? 0) + ($blue['wardsKilled'] ?? 0);
            $rWards = ($red['wardsPlaced'] ?? 0) + ($red['wardsKilled'] ?? 0);
            $visDivisor = in_array($role, ['UTILITY', 'JUNGLE']) ? 10 : 20;
            $wardDivisor = in_array($role, ['UTILITY', 'JUNGLE']) ? 8 : 15;
            $visNorm = max(-1, min(1, ($bVis - $rVis) / $visDivisor));
            $wardNorm = max(-1, min(1, ($bWards - $rWards) / $wardDivisor));
            $combinedVision = ($visNorm * 0.6 + $wardNorm * 0.4);
            $visScore = $combinedVision * $w['vision'];
            $score += $visScore;
            if (abs($visScore) > 0.3) $factors[] = ['metric' => 'Görüş', 'value' => round($visScore, 1)];

            // İyileştirme + Kalkan (takım arkadaşlarına)
            $bHeal = $blue['teamHealing'] ?? 0;
            $rHeal = $red['teamHealing'] ?? 0;
            $healDiff = $bHeal - $rHeal;
            $healNorm = max(-1, min(1, $healDiff / 8000));
            $healScore = $healNorm * $w['healing'];
            $score += $healScore;
            if (abs($healScore) > 0.3) $factors[] = ['metric' => 'İyileştirme', 'value' => round($healScore, 1)];

            // Verdict
            if ($score > 5) {
                $verdict = 'blue_dominant';
            } elseif ($score > 2) {
                $verdict = 'blue_ahead';
            } elseif ($score < -5) {
                $verdict = 'red_dominant';
            } elseif ($score < -2) {
                $verdict = 'red_ahead';
            } else {
                $verdict = 'even';
            }

            // Öne çıkan istatistikler
            $highlights = [];
            if (abs($csDiff) >= 15) {
                $highlights[] = ($csDiff > 0 ? '+' : '') . $csDiff . ' CS';
            }
            if (abs($goldDiff) >= 1000) {
                $highlights[] = ($goldDiff > 0 ? '+' : '') . round($goldDiff / 1000, 1) . 'k gold';
            }
            if (abs($blue['kills'] - $red['kills']) >= 2) {
                $kDiff = $blue['kills'] - $red['kills'];
                $highlights[] = ($kDiff > 0 ? '+' : '') . $kDiff . ' kill';
            }

            // Factors'ı mutlak değere göre sırala, en etkili olanı ilk göster
            usort($factors, fn($a, $b) => abs($b['value']) <=> abs($a['value']));

            $analysis[] = [
                'role'       => $role,
                'label'      => $roleLabels[$role] ?? $role,
                'bluePlayer' => $blue['summonerName'],
                'redPlayer'  => $red['summonerName'],
                'csDiff'     => $csDiff,
                'goldDiff'   => $goldDiff,
                'dmgDiff'    => $dmgDiff,
                'verdict'    => $verdict,
                'highlights' => $highlights,
                'factors'    => array_slice($factors, 0, 3), // En etkili 3 faktör
                'score'      => round($score, 1),
            ];
        }

        return $analysis;
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
                    'queueType'    => self::QUEUE_NAMES[$info['queueId'] ?? 0] ?? 'Diğer',
                    'role'         => ($player['teamPosition'] ?: $player['individualPosition'] ?: '') === 'BOT' ? 'BOTTOM' : ($player['teamPosition'] ?: $player['individualPosition'] ?: ''),
                    'gameCreation' => $info['gameCreation'],
                    'champLevel'   => $player['champLevel'],
                    'doubleKills'  => $player['doubleKills'] ?? 0,
                    'tripleKills'  => $player['tripleKills'] ?? 0,
                    'quadraKills'  => $player['quadraKills'] ?? 0,
                    'pentaKills'   => $player['pentaKills'] ?? 0,
                    'badges'       => $this->calculateBadges($player, $info),
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
        $cacheKey = "season_roles:v3:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $roleLabels = ['TOP' => 'Top', 'JUNGLE' => 'Jungle', 'MIDDLE' => 'Mid', 'BOTTOM' => 'ADC', 'UTILITY' => 'Support'];
            $roleIcons  = ['TOP' => 'top', 'JUNGLE' => 'jungle', 'MIDDLE' => 'mid', 'BOTTOM' => 'bot', 'UTILITY' => 'support'];

            // Sezon başlangıcı: Ocak 2026
            $seasonStart = $this->seasonStartTimestamp();

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
                    $matchIds = $this->getSeasonMatchIds($puuid, $queueId);
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
                                // Riot API bazen "BOT" döner, "BOTTOM"a normalize et
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
     * Sezon boyunca ranked winrate geçmişi — solo ve flex ayrı.
     * Her maç sonrası kümülatif winrate + tarih hesaplar.
     */
    public function getWinrateTimeline(string $puuid): array
    {
        $cacheKey = "winrate_timeline:v5:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $result = ['solo' => null, 'flex' => null];

            foreach ([420 => 'solo', 440 => 'flex'] as $queueId => $key) {
                $matches = [];
                try {
                    $matchIds = $this->getSeasonMatchIds($puuid, $queueId);
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->getMatchDetail($matchId);

                        // Remake'leri atla (5 dakikadan kısa maçlar)
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
     * Sezon boyunca oynanmış ranked maçlardan şampiyon istatistikleri.
     * Her şampiyon için: oyun, galibiyet, mağlubiyet, winRate, ortalama KDA.
     */
    public function getSeasonChampionStats(string $puuid): array
    {
        $cacheKey = "season_champs:v3:{$puuid}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $seasonStart = $this->seasonStartTimestamp();

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
                    $matchIds = $this->getSeasonMatchIds($puuid, $queueId);
                } catch (\Exception $e) {
                    continue;
                }

                foreach ($matchIds as $matchId) {
                    try {
                        $detail = $this->getMatchDetail($matchId);

                        // Remake maçları atla (5 dakikadan kısa)
                        if (($detail['info']['gameDuration'] ?? 0) < 300) continue;

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

        // Sık alınan rozetler — maçlardan topla
        $badgeCounts = [];
        foreach ($matches as $m) {
            foreach ($m['badges'] ?? [] as $b) {
                $key = $b['key'];
                if (!isset($badgeCounts[$key])) {
                    $badgeCounts[$key] = ['count' => 0, 'label' => $b['label'], 'desc' => $b['desc'], 'category' => $b['category'], 'tier' => $b['tier']];
                }
                $badgeCounts[$key]['count']++;
                // En yüksek tier'ı tut
                if ($b['tier'] === 'gold') $badgeCounts[$key]['tier'] = 'gold';
            }
        }
        // Frekansa göre sırala, en az 2 maçta alınmış olanları göster
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
            'frequentBadges' => array_slice($frequentBadges, 0, 8),
        ];
    }

    /**
     * Maç performansına göre rozet hesapla.
     * Tier sistemi LoL rank renklerine karşılık gelir (zorluk göstergesi):
     *   challenger > grandmaster > diamond > emerald > gold > silver > bronze
     */
    private function calculateBadges(array $p, array $info): array
    {
        $c = $p['challenges'] ?? [];
        $badges = [];
        $role = ($p['teamPosition'] ?: $p['individualPosition'] ?: '');
        if ($role === 'BOT') $role = 'BOTTOM';

        // === SAVAŞ ===

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

        if ($c['firstBloodKill'] ?? false) {
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

        // === HASAR ===

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

        // === FARMING ===

        $cs10 = $c['laneMinionsFirst10Minutes'] ?? 0;
        if ($cs10 >= 65 && in_array($role, ['TOP', 'MIDDLE', 'BOTTOM'])) {
            $tier = $cs10 >= 95 ? 'challenger' : ($cs10 >= 88 ? 'grandmaster' : ($cs10 >= 80 ? 'diamond' : ($cs10 >= 72 ? 'emerald' : 'gold')));
            $badges[] = ['key' => 'cs_master', 'label' => 'CS Ustası', 'desc' => "10dk'da {$cs10} CS", 'category' => 'farming', 'tier' => $tier];
        }

        $csAdv = $c['maxCsAdvantageOnLaneOpponent'] ?? 0;
        if ($csAdv >= 15) {
            $tier = $csAdv >= 60 ? 'challenger' : ($csAdv >= 40 ? 'diamond' : ($csAdv >= 25 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'cs_lead', 'label' => 'CS Baskını', 'desc' => "+{$csAdv} CS farkı (max)", 'category' => 'farming', 'tier' => $tier];
        }

        $gpm = $c['goldPerMinute'] ?? 0;
        if ($gpm >= 400) {
            $tier = $gpm >= 650 ? 'challenger' : ($gpm >= 550 ? 'diamond' : ($gpm >= 480 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'gold_maker', 'label' => 'Altın Madencisi', 'desc' => round($gpm) . ' gold/dk', 'category' => 'farming', 'tier' => $tier];
        }

        // === OBJEKTİF ===

        $plates = $c['turretPlatesTaken'] ?? 0;
        if ($plates >= 2) {
            $tier = $plates >= 7 ? 'challenger' : ($plates >= 5 ? 'diamond' : ($plates >= 3 ? 'gold' : 'silver'));
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

        // === GÖRÜŞ ===

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

        // === SKOR KATKISI ===

        $kp = $c['killParticipation'] ?? 0;
        if ($kp >= 0.65) {
            $tier = $kp >= 0.90 ? 'challenger' : ($kp >= 0.80 ? 'diamond' : ($kp >= 0.72 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'team_player', 'label' => 'Takım Oyuncusu', 'desc' => "%" . round($kp * 100) . " kill katılımı", 'category' => 'teamplay', 'tier' => $tier];
        }

        $ssDodge = $c['skillshotsDodged'] ?? 0;
        if ($ssDodge >= 20) {
            $tier = $ssDodge >= 70 ? 'challenger' : ($ssDodge >= 50 ? 'diamond' : ($ssDodge >= 35 ? 'emerald' : 'gold'));
            $badges[] = ['key' => 'dodge_master', 'label' => 'Kaçış Ustası', 'desc' => "{$ssDodge} skillshot savuşturdu", 'category' => 'combat', 'tier' => $tier];
        }

        return $badges;
    }
}
