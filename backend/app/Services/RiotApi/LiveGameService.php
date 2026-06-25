<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

/**
 * Canlı maç orkestratör servisi.
 *
 * İki katmanlı veri sağlar:
 *   1) getActiveGame()       → HIZLI: spectator + her oyuncunun rank'i + şampiyon/spell/rün.
 *                              Kartların ÖN yüzü anında dolar.
 *   2) getPlayerEnrichment() → AĞIR: oyuncunun son maçlarından oynayış-tarzı rozetleri,
 *                              son maç listesi, ELW ortalaması ve bu şampiyondaki build.
 *                              Client tarafından kişi başına (throttle'lı) çağrılır.
 *
 * Mevcut servisleri yeniden kullanır — yeni Riot endpoint'i sadece Spectator-V5.
 */
class LiveGameService
{
    public function __construct(
        private SpectatorService $spectator,
        private LeagueService $league,
        private DataDragonService $ddragon,
        private MatchService $match,
    ) {}

    public function isInGame(string $puuid): bool
    {
        return $this->spectator->isInGame($puuid);
    }

    /**
     * HIZLI katman — zenginleştirilmiş aktif oyun. Oyunda değilse null.
     */
    public function getActiveGame(string $puuid): ?array
    {
        $game = $this->spectator->getActiveGame($puuid);
        if (!$game) {
            return null;
        }
        return $this->enrichGame($game, $puuid);
    }

    /**
     * Ham spectator/featured oyun objesini zenginleştir (hızlı katman).
     * $searchedPuuid null ise (featured games) takım 100 "ally" kabul edilir.
     */
    public function enrichGame(array $game, ?string $searchedPuuid): array
    {
        $puuid = $searchedPuuid;
        $rateLimited = false;

        // DDragon yardımcı haritaları (hepsi 24sa cache'li → ekstra API isteği yok)
        $champMap = $this->championIdMap();
        $spellMap = $this->ddragon->getSpellMap();
        $runeMap  = $this->ddragon->getRuneMap();
        // Meraki koridor pozisyonları (rol tahmini için) — 24sa cache, tek HTTP
        try {
            $positions = $this->ddragon->getChampionPositions();
        } catch (\Exception $e) {
            $positions = [];
        }

        // Aranan oyuncunun takımı = "senin takımın"
        $searchedTeamId = null;
        foreach ($game['participants'] ?? [] as $p) {
            if (($p['puuid'] ?? '') === $puuid) {
                $searchedTeamId = $p['teamId'] ?? null;
                break;
            }
        }
        // Featured games (searchedPuuid yok) → takım 100'ü ally say.
        if ($searchedTeamId === null) {
            $searchedTeamId = $game['participants'][0]['teamId'] ?? 100;
        }

        $allyTeam = [];
        $enemyTeam = [];
        foreach ($game['participants'] ?? [] as $p) {
            $participant = $this->enrichParticipant($p, $puuid, $champMap, $spellMap, $runeMap, $positions, $rateLimited);
            if (($p['teamId'] ?? null) === $searchedTeamId) {
                $allyTeam[] = $participant;
            } else {
                $enemyTeam[] = $participant;
            }
        }

        // Takım-seviyesi rol ataması — 5 oyuncuya BENZERSİZ rol (Smite→orman kilitli, gerisi
        // şampiyon pozisyon tercihiyle açgözlü) + koridor sırasına (Top→JG→Mid→ADC→Sup) diz.
        $allyTeam = $this->assignTeamRoles($allyTeam, $positions);
        $enemyTeam = $this->assignTeamRoles($enemyTeam, $positions);

        // Ban'lar
        $bans = array_map(fn($b) => [
            'championId' => $b['championId'] ?? -1,
            'teamId'     => $b['teamId'] ?? 0,
            'pickTurn'   => $b['pickTurn'] ?? 0,
            'image'      => ($b['championId'] ?? -1) > 0
                ? $this->championImageById($b['championId'], $champMap)
                : null,
        ], $game['bannedChampions'] ?? []);

        $queueId = $game['gameQueueConfigId'] ?? 0;

        return [
            'status'         => 'ingame',
            'gameId'         => $game['gameId'] ?? null,
            'gameStartTime'  => $game['gameStartTime'] ?? 0,
            'gameLength'     => $game['gameLength'] ?? 0,
            'mapId'          => $game['mapId'] ?? null,
            'queueId'        => $queueId,
            'queueName'      => MatchDataService::QUEUE_NAMES[$queueId] ?? 'Özel',
            'searchedPuuid'  => $puuid,
            'searchedTeamId' => $searchedTeamId,
            'allyTeam'       => $allyTeam,
            'enemyTeam'      => $enemyTeam,
            'bans'           => $bans,
            'rateLimited'    => $rateLimited,
        ];
    }

    /**
     * Takım-seviyesi rol ataması: 5 oyuncuya BENZERSİZ rol + koridor sırasına diz.
     * Smite → orman (kilit), gerisi şampiyon pozisyon tercihiyle açgözlü; çakışırsa boş role.
     * 'autofilled' = atanan rol şampiyonun tipik pozisyonu değil (off-role işareti).
     */
    private function assignTeamRoles(array $team, array $positions): array
    {
        $order = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
        $norm = ['MID' => 'MIDDLE', 'BOT' => 'BOTTOM', 'ADC' => 'BOTTOM', 'ADCARRY' => 'BOTTOM', 'SUPPORT' => 'UTILITY'];
        $prefsOf = function ($p) use ($positions, $norm) {
            $champ = $p['champion']['id'] ?? null;
            $raw = $champ ? ($positions[$champ] ?? []) : [];
            return array_values(array_filter(array_map(fn ($r) => $norm[strtoupper($r)] ?? strtoupper($r), $raw)));
        };

        $assigned = [];
        $used = [];
        // 1. Smite → JUNGLE (kilit)
        foreach ($team as $i => $p) {
            if (($p['role'] ?? null) === 'JUNGLE' && !in_array('JUNGLE', $used, true)) {
                $assigned[$i] = 'JUNGLE';
                $used[] = 'JUNGLE';
            }
        }
        // 2. Açgözlü — herkes en çok tercih ettiği boş role
        foreach ($team as $i => $p) {
            if (isset($assigned[$i])) {
                continue;
            }
            foreach ($prefsOf($p) as $r) {
                if (in_array($r, $order, true) && !in_array($r, $used, true)) {
                    $assigned[$i] = $r;
                    $used[] = $r;
                    break;
                }
            }
        }
        // 3. Kalanlar → boş roller
        $free = array_values(array_diff($order, $used));
        $fi = 0;
        foreach ($team as $i => $p) {
            if (!isset($assigned[$i])) {
                $assigned[$i] = $free[$fi++] ?? 'MIDDLE';
            }
        }
        // Uygula + autofill işareti + koridor sırasına diz
        foreach ($team as $i => &$p) {
            $p['role'] = $assigned[$i];
            $prefs = $prefsOf($p);
            $p['autofilled'] = $prefs && !in_array($assigned[$i], $prefs, true);
        }
        unset($p);
        usort($team, fn ($a, $b) => array_search($a['role'], $order) <=> array_search($b['role'], $order));
        return $team;
    }

    /**
     * AĞIR katman — oyuncunun son maçlarından türetilen veriler.
     * Kişi başına çağrılır, 5dk cache (oyun ortasında geçmiş maçlar değişmez).
     *
     * @param  string       $puuid
     * @param  string|null  $championName  Canlı maçta oynadığı şampiyon (build seçimi için)
     */
    public function getPlayerEnrichment(string $puuid, ?string $championName = null): array
    {
        $base = Cache::remember("live:player:v2:{$puuid}", 300, function () use ($puuid) {
            try {
                // DB-first; çoğu maç DB'den döner. RATE-LIMIT: 10 maç ile sınırlı —
                // sezon sorgusu (getSeasonChampionStats) BİLİNÇLİ kullanılmıyor; o,
                // tanınmayan bir rakip için yüzlerce Match-V5 isteği demek olurdu.
                // "Bu şampiyonda performans" aşağıda son maçlardan türetilir (0 ekstra istek).
                $matches = $this->match->getRecentMatches($puuid, 10, 0);
            } catch (\Exception $e) {
                return [
                    'error'           => $e->getCode() === 429 ? 'rate_limited' : 'failed',
                    'playstyleBadges' => [],
                    'recentGames'     => [],
                    'recentStats'     => null,
                    'championAgg'     => [],
                    'elwAverage'      => null,
                    'buildsByChampion'=> [],
                ];
            }

            $recentStats = $this->match->calculateRecentStats($matches, $puuid);

            // Oynayış-tarzı rozetleri = sık tekrar eden POZİTİF rozetler (negatif hariç)
            $playstyle = array_values(array_filter(
                $recentStats['frequentBadges'] ?? [],
                fn($b) => ($b['category'] ?? '') !== 'negative'
            ));
            $playstyle = array_slice($playstyle, 0, 5);

            // Son maç listesi (kompakt — DPM tarzı W/L şeridi)
            $recentGames = array_map(fn($m) => [
                'matchId'   => $m['matchId'] ?? null,
                'champion'  => $m['champion'] ?? null,
                'win'       => $m['win'] ?? null,
                'kills'     => $m['kills'] ?? 0,
                'deaths'    => $m['deaths'] ?? 0,
                'assists'   => $m['assists'] ?? 0,
                'kda'       => $m['kda'] ?? null,
                'role'         => $m['role'] ?? '',
                'queueType'    => $m['queueType'] ?? '',
                'elwScore'     => $m['ranking']['elwScore'] ?? null,
                'matchRank'    => $m['ranking']['rank'] ?? null,
                'perfLabel'    => $m['perfLabel'] ?? null,
                'gameCreation' => $m['gameCreation'] ?? null,
            ], array_slice($matches, 0, 12));

            // ELW ortalaması (son maçlar)
            $scores = array_values(array_filter(
                array_map(fn($m) => $m['ranking']['elwScore'] ?? null, $matches),
                fn($v) => $v !== null
            ));
            $elwAverage = count($scores) ? round(array_sum($scores) / count($scores), 1) : null;

            // Şampiyon bazlı build (arka yüz) + mini-istatistik — SON MAÇLARDAN, ekstra istek YOK.
            $buildsByChampion = [];
            $championAgg = []; // name => [games, wins, kills, deaths, assists]
            foreach ($matches as $m) {
                $cn = $m['champion']['name'] ?? null;
                if (!$cn) continue;
                if (!isset($buildsByChampion[$cn])) {
                    $buildsByChampion[$cn] = [
                        'champion' => $m['champion'],
                        'items'    => $m['items'] ?? [],
                        'spells'   => $m['spells'] ?? [],
                        'runes'    => $m['runes'] ?? [],
                        'win'      => $m['win'] ?? null,
                        'matchId'  => $m['matchId'] ?? null,
                    ];
                }
                if (!isset($championAgg[$cn])) {
                    $championAgg[$cn] = ['games' => 0, 'wins' => 0, 'kills' => 0, 'deaths' => 0, 'assists' => 0];
                }
                $championAgg[$cn]['games']++;
                if ($m['win'] ?? false) $championAgg[$cn]['wins']++;
                $championAgg[$cn]['kills']   += $m['kills'] ?? 0;
                $championAgg[$cn]['deaths']  += $m['deaths'] ?? 0;
                $championAgg[$cn]['assists'] += $m['assists'] ?? 0;
            }

            return [
                'playstyleBadges' => $playstyle,
                'recentGames'     => $recentGames,
                'recentStats'     => [
                    'winRate'    => $recentStats['winRate'] ?? 0,
                    'wins'       => $recentStats['wins'] ?? 0,
                    'losses'     => $recentStats['losses'] ?? 0,
                    'totalGames' => $recentStats['totalGames'] ?? 0,
                    'avgKDA'     => $recentStats['avgKDA'] ?? null,
                    'mainRole'   => $recentStats['mainRole'] ?? null,
                    'roleStats'  => $recentStats['roleStats'] ?? [],
                ],
                'championAgg'      => $championAgg,
                'elwAverage'       => $elwAverage,
                'buildsByChampion' => $buildsByChampion,
            ];
        });

        // Build seçimi championName'e bağlı → cache dışında seç
        $builds = $base['buildsByChampion'] ?? [];
        $build = ($championName && isset($builds[$championName])) ? $builds[$championName] : null;

        // Bu şampiyondaki performans — son maçlardan türetilmiş mini-istatistik (sezon değil)
        $championStat = null;
        $agg = $base['championAgg'][$championName] ?? null;
        if ($championName && $agg) {
            $g = max(1, $agg['games']);
            $championStat = [
                'championName' => $championName,
                'games'        => $agg['games'],
                'wins'         => $agg['wins'],
                'winRate'      => $agg['games'] ? round($agg['wins'] / $agg['games'] * 100) : 0,
                'avgKda'       => [
                    'kills'   => round($agg['kills'] / $g, 1),
                    'deaths'  => round($agg['deaths'] / $g, 1),
                    'assists' => round($agg['assists'] / $g, 1),
                    'ratio'   => $agg['deaths'] > 0
                        ? round(($agg['kills'] + $agg['assists']) / $agg['deaths'], 2)
                        : 'Perfect',
                ],
                'source'       => 'recent', // son maçlardan (sezon sorgusu değil)
            ];
        }

        return [
            'puuid'           => $puuid,
            'championName'    => $championName,
            'playstyleBadges' => $base['playstyleBadges'] ?? [],
            'recentGames'     => $base['recentGames'] ?? [],
            'recentStats'     => $base['recentStats'] ?? null,
            'elwAverage'      => $base['elwAverage'] ?? null,
            'build'           => $build,
            'championStat'    => $championStat,
            'error'           => $base['error'] ?? null,
        ];
    }

    // ────────────────────────────────────────────
    //  Private helpers
    // ────────────────────────────────────────────

    /**
     * Tek bir spectator participant'ını hızlı alanlarla zenginleştir.
     */
    private function enrichParticipant(array $p, ?string $searchedPuuid, array $champMap, array $spellMap, array $runeMap, array $positions, bool &$rateLimited): array
    {
        $pid = $p['puuid'] ?? '';
        $isBot = ($p['bot'] ?? false) || $pid === '' || str_starts_with($pid, 'BOT');

        // İsim: spectator-v5 riotId ("Name#TAG") verir; eski summonerName'e düş
        $riotId = $p['riotId'] ?? '';
        if ($riotId !== '' && str_contains($riotId, '#')) {
            [$name, $tag] = explode('#', $riotId, 2);
        } else {
            $name = $p['summonerName'] ?? ($riotId ?: '?');
            $tag = '';
        }

        // Şampiyon
        $championId = $p['championId'] ?? 0;
        $champData = $champMap[(string) $championId] ?? null;
        $champion = [
            'id'    => $champData['id'] ?? null,
            'name'  => $champData['name'] ?? '?',
            'image' => $champData ? $this->ddragon->championIconUrl($champData['id']) : null,
        ];

        // Spell'ler
        $spells = [
            $spellMap[$p['spell1Id'] ?? 0] ?? ['name' => '?', 'image' => ''],
            $spellMap[$p['spell2Id'] ?? 0] ?? ['name' => '?', 'image' => ''],
        ];

        // Rünler (keystone + ana/yan ağaç + tüm seçili rünler — hover için)
        $runes = null;
        $perks = $p['perks'] ?? null;
        if ($perks) {
            $ids = $perks['perkIds'] ?? [];
            $keystoneId = $ids[0] ?? null;
            $runes = [
                'keystone'  => ($keystoneId && isset($runeMap[$keystoneId])) ? $runeMap[$keystoneId] : null,
                'primary'   => isset($runeMap[$perks['perkStyle'] ?? 0]) ? $runeMap[$perks['perkStyle']] : null,
                'secondary' => isset($runeMap[$perks['perkSubStyle'] ?? 0]) ? $runeMap[$perks['perkSubStyle']] : null,
                'all'       => array_values(array_filter(array_map(
                    fn($id) => $runeMap[$id] ?? null,
                    $ids
                ))),
            ];
        }

        // Koridor (rol) tahmini: Smite (11) → JUNGLE; değilse Meraki birincil pozisyon.
        $role = null;
        if (($p['spell1Id'] ?? 0) === 11 || ($p['spell2Id'] ?? 0) === 11) {
            $role = 'JUNGLE';
        } elseif ($champData && !empty($positions[$champData['id']])) {
            $norm = [
                'TOP' => 'TOP', 'JUNGLE' => 'JUNGLE', 'MIDDLE' => 'MIDDLE', 'MID' => 'MIDDLE',
                'BOTTOM' => 'BOTTOM', 'BOT' => 'BOTTOM', 'ADC' => 'BOTTOM', 'ADCARRY' => 'BOTTOM',
                'SUPPORT' => 'UTILITY', 'UTILITY' => 'UTILITY',
            ];
            $role = $norm[strtoupper($positions[$champData['id']][0])] ?? null;
        }

        // Rank (bot değilse) — cache'li (30dk). 429'da bayrak set et.
        $rank = ['solo' => null, 'flex' => null];
        if (!$isBot && $pid !== '') {
            try {
                $rank = $this->league->getRankedInfo($pid);
            } catch (\Exception $e) {
                if ($e->getCode() === 429) $rateLimited = true;
            }
        }

        return [
            'puuid'        => $pid,
            'summonerName' => $name,
            'tagLine'      => $tag,
            'teamId'       => $p['teamId'] ?? 0,
            'isMe'         => $pid === $searchedPuuid,
            'isBot'        => $isBot,
            'championId'   => $championId,
            'champion'     => $champion,
            'role'         => $role,
            'spells'       => $spells,
            'runes'        => $runes,
            'rank'         => $rank,
        ];
    }

    /**
     * championId (numerik) → DDragon şampiyon verisi haritası.
     * getChampions() isimle anahtarlı döner; 'key' (numerik id) ile ters harita kurar.
     */
    private function championIdMap(): array
    {
        $map = [];
        foreach ($this->ddragon->getChampions() as $champ) {
            $map[(string) $champ['key']] = $champ;
        }
        return $map;
    }

    private function championImageById(int $championId, array $champMap): ?string
    {
        $champData = $champMap[(string) $championId] ?? null;
        return $champData ? $this->ddragon->championIconUrl($champData['id']) : null;
    }
}
