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
    ) {}

    /**
     * Son N maçın ID'lerini getir.
     */
    public function getMatchIds(string $puuid, int $count = 20): array
    {
        $cacheKey = "match:ids:{$puuid}:{$count}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $count) {
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['count' => $count]
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
     * Son N maçın özet bilgilerini getir.
     * Her maçtan sadece aranan oyuncunun verilerini çıkarır.
     */
    public function getRecentMatches(string $puuid, int $count = 20): array
    {
        $matchIds = $this->getMatchIds($puuid, $count);
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

        // Rol analizi — en çok hangi koridor
        $roleNames = ['TOP' => 'Top', 'JUNGLE' => 'Jungle', 'MIDDLE' => 'Mid', 'BOTTOM' => 'ADC', 'UTILITY' => 'Support'];
        $roleCounts = [];
        foreach ($matches as $m) {
            $role = $m['role'] ?? '';
            if ($role) $roleCounts[$role] = ($roleCounts[$role] ?? 0) + 1;
        }
        arsort($roleCounts);

        // Main role tespiti
        $mainRole = null;
        $roleKeys = array_keys($roleCounts);
        if (count($roleKeys) >= 2) {
            $first = $roleCounts[$roleKeys[0]];
            $second = $roleCounts[$roleKeys[1]];
            // İlk iki rol yakınsa "Top/Mid Main" gibi göster
            if ($second >= $first * 0.6) {
                $mainRole = ($roleNames[$roleKeys[0]] ?? $roleKeys[0]) . '/' . ($roleNames[$roleKeys[1]] ?? $roleKeys[1]) . ' Main';
            } else {
                $mainRole = ($roleNames[$roleKeys[0]] ?? $roleKeys[0]) . ' Main';
            }
        } elseif (count($roleKeys) === 1) {
            $mainRole = ($roleNames[$roleKeys[0]] ?? $roleKeys[0]) . ' Main';
        }

        // Eşit dağılım kontrolü
        if (count($roleCounts) >= 4) {
            $vals = array_values($roleCounts);
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
        ];
    }
}
