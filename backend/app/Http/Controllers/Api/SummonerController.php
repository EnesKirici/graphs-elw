<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CachedPlayer;
use App\Models\LpSnapshot;
use App\Services\RiotApi\SummonerService;
use App\Services\RiotApi\LeagueService;
use App\Services\RiotApi\ChampionMasteryService;
use App\Services\RiotApi\MatchService;
use App\Services\RiotApi\MatchDataService;
use App\Services\RiotApi\DataDragonService;
use App\Services\LpTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SummonerController extends Controller
{
    public function __construct(
        private SummonerService $summoner,
        private LeagueService $league,
        private ChampionMasteryService $mastery,
        private MatchService $match,
        private MatchDataService $matchData,
        private DataDragonService $ddragon,
        private LpTrackingService $lpTracking,
    ) {}

    public function search(Request $request): JsonResponse
    {
        $name = $request->query('name');
        $tag = $request->query('tag');

        if (!$name || !$tag) {
            return response()->json([
                'error' => 'name ve tag parametreleri gerekli.'
            ], 400);
        }

        try {
            $profile = $this->summoner->searchByRiotId($name, $tag);
            return $this->buildFullResponse($profile);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 500;
            if ($code === 429) {
                $cooldown = Cache::get('riot:rate_limit_cooldown');
                $retryAfter = $cooldown ? max(0, $cooldown - time()) : 5;
                return response()->json([
                    'error'       => 'Riot API istek limiti aşıldı.',
                    'rateLimited' => true,
                    'retryAfter'  => $retryAfter,
                ], 429);
            }
            return response()->json([
                'error' => $code === 404
                    ? "Oyuncu bulunamadı: {$name}#{$tag}"
                    : $e->getMessage(),
            ], $code >= 100 && $code < 600 ? $code : 500);
        }
    }

    public function show(string $puuid): JsonResponse
    {
        try {
            $profile = $this->summoner->getByPuuid($puuid);
            return $this->buildFullResponse($profile);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 500;
            if ($code === 429) {
                $cooldown = Cache::get('riot:rate_limit_cooldown');
                $retryAfter = $cooldown ? max(0, $cooldown - time()) : 5;
                return response()->json([
                    'error'       => 'Riot API istek limiti aşıldı.',
                    'rateLimited' => true,
                    'retryAfter'  => $retryAfter,
                ], 429);
            }
            return response()->json(['error' => $e->getMessage()], $code >= 100 && $code < 600 ? $code : 500);
        }
    }

    /**
     * Sayfalı maç geçmişi.
     * GET /api/v1/summoner/{puuid}/matches?page=1
     */
    public function matches(string $puuid, Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = 10;
        $start = ($page - 1) * $perPage;

        try {
            $matches = $this->match->getRecentMatchesPaginated($puuid, $perPage, $start);
            $stats = $this->match->calculateRecentStats($matches, $puuid);

            return response()->json([
                'matches' => $matches,
                'stats'   => $stats,
                'page'    => $page,
                'hasMore' => count($matches) === $perPage,
            ]);
        } catch (\Exception $e) {
            return response()->json(['matches' => [], 'stats' => null, 'page' => $page, 'hasMore' => false]);
        }
    }

    /**
     * Tek maç detayı — 10 oyuncunun tüm istatistikleri.
     * GET /api/v1/matches/{matchId}
     */
    public function matchDetail(string $matchId): JsonResponse
    {
        try {
            $data = $this->match->getMatchDetailFull($matchId);
            return response()->json($data);
        } catch (\Exception $e) {
            $code = $e->getCode() ?: 500;
            return response()->json(
                ['error' => 'Maç detayı alınamadı.'],
                $code >= 100 && $code < 600 ? $code : 500
            );
        }
    }

    /**
     * Oyuncu cache'ini temizle ve güncel veriyi döndür.
     * POST /api/v1/summoner/{puuid}/refresh
     */
    public function refresh(string $puuid): JsonResponse
    {
        // Bu oyuncuya ait tüm cache key pattern'lerini temizle
        $patterns = [
            "league:ranked:{$puuid}",
            "summoner:puuid:{$puuid}",
            "mastery:top:{$puuid}:*",
            "mastery:score:{$puuid}",
        ];

        // Wildcard olmayan key'leri direkt sil
        foreach ($patterns as $pattern) {
            if (!str_contains($pattern, '*')) {
                Cache::forget($pattern);
            }
        }

        // Sezon/match bazlı cache'ler — versiyon prefix'li
        $seasonKeys = [
            "season_match_ids:v2:{$puuid}:420",
            "season_match_ids:v2:{$puuid}:440",
            "season_match_ids:v2:{$puuid}:400",
            "season_match_ids:v2:{$puuid}:430",
            "season_match_ids:v2:{$puuid}:490",
            "winrate_timeline:v5:{$puuid}",
            "season_roles:v3:{$puuid}",
            "season_champs:v3:{$puuid}",
            "match:ids:{$puuid}:10:0",
            "match:ids:{$puuid}:20:0",
            "challenge_avgs:v2:{$puuid}",
            "duo_partners:v3:{$puuid}",
            "season_badges:v2:{$puuid}",
        ];

        foreach ($seasonKeys as $key) {
            Cache::forget($key);
        }

        // Güncel veriyi yeniden çek ve döndür
        try {
            $profile = $this->summoner->getByPuuid($puuid);
            return $this->buildFullResponse($profile);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Yenileme başarısız.'], 500);
        }
    }

    private function buildFullResponse(array $profile): JsonResponse
    {
        $puuid = $profile['puuid'];
        $rateLimited = false;

        // Ranked, mastery — rate limit yerse kısmi veri ile devam et
        $ranked = ['solo' => null, 'flex' => null];
        $masteries = [];
        $totalScore = 0;

        try {
            $ranked = $this->league->getRankedInfo($puuid);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        try {
            $masteries = $this->mastery->getTopMasteries($puuid, 10);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        try {
            $totalScore = $this->mastery->getTotalScore($puuid);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // ────────────────────────────────────────────
        //  AKILLI YÜKLEME:
        //  1. Son 10 maç + Sezon ranked maçları paralel preload
        //  2. Timeline'lar ilk yüklemede çekilmez (maç detayında çekilir)
        //  3. DB'de olan maçlar tekrar çekilmez (0 istek)
        // ────────────────────────────────────────────

        // Son 10 maç ID + TÜM sezon maç ID'lerini topla ve toplu preload
        // Solo(420), Flex(440), Normal(400), Blind(430), Quickplay(490)
        // Hepsini önceden yükle → istatistik servisleri tek tek API çağrısı yapmaz
        $seasonOnlyIds = [];
        try {
            $preloadIds = [];
            $recentIds = $this->matchData->getMatchIds($puuid, 10, 0);
            $preloadIds = array_merge($preloadIds, $recentIds);
            foreach ([420, 440, 400, 430, 490] as $queueId) {
                try {
                    $ids = $this->matchData->getSeasonMatchIds($puuid, $queueId);
                    $preloadIds = array_merge($preloadIds, $ids);
                    $seasonOnlyIds = array_merge($seasonOnlyIds, $ids);
                } catch (\Exception $e) {
                    if ($e->getCode() === 429) $rateLimited = true;
                }
            }
            $preloadIds = array_unique($preloadIds);
            $this->matchData->preloadMatchDetails($preloadIds);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }
        // Sezon tüm maç sayısı — preload sırasında topladığımız ID'ler.
        // 5 queue × 100 = 500'e kadar (Riot match-v5 /ids tek istekte max 100)
        $totalSeasonMatches = count(array_unique($seasonOnlyIds));

        $recentMatches = [];
        $recentStats = null;
        $seasonRoles = null;
        $seasonChampions = [];
        $winrateTimeline = [];
        $bannerChampion = null;
        $bannerSkins = [0];
        try {
            $recentMatches = $this->match->getRecentMatches($puuid, 10, 0, true);
            $recentStats = $this->match->calculateRecentStats($recentMatches, $puuid);

            $champId = $recentStats['mostPlayedChampion']['id'] ?? null;
            if (!$champId && !empty($masteries)) {
                $champId = $masteries[0]['championName'] ?? null;
            }

            if ($champId) {
                $bannerChampion = $champId;
                try {
                    $champDetail = $this->ddragon->getChampionDetail($champId);
                    $bannerSkins = collect($champDetail['skins'] ?? [])
                        ->pluck('num')
                        ->values()
                        ->toArray();
                } catch (\Exception $e) {
                    $bannerSkins = [0];
                }
            }
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // LP snapshot — mevcut LP'yi en son ranked maçla eşleştirip kaydet
        // Sonra her maça LP değişimini hesaplayıp ekle
        try {
            // En yeni ranked maçı kuyruk bazında bul (ilk eşleşen = en yeni — eski davranış).
            $newest = ['solo' => null, 'flex' => null];
            foreach ($recentMatches as $rm) {
                $qt = $rm['queueType'] ?? '';
                if ($qt === 'SoloQ' && $newest['solo'] === null) $newest['solo'] = $rm['matchId'] ?? null;
                if ($qt === 'Flex'  && $newest['flex'] === null) $newest['flex'] = $rm['matchId'] ?? null;
            }
            $this->lpTracking->recordSnapshots($puuid, $ranked, $newest);
            $recentMatches = $this->lpTracking->attachLpChanges($puuid, $recentMatches);
        } catch (\Exception $e) {}

        // Sezon verileri — DB'de maç varsa hesapla, yoksa recentMatches'tan fallback
        try {
            $seasonRoles = $this->match->getSeasonRoleStats($puuid);
            $seasonChampions = $this->match->getSeasonChampionStats($puuid);

            // Mastery bilgisini sezon şampiyon verisine ekle
            $masteryMap = [];
            foreach ($masteries as $m) {
                $masteryMap[$m['championName']] = [
                    'level'  => $m['championLevel'],
                    'points' => $m['championPoints'],
                ];
            }
            foreach (['all', 'ranked', 'normal'] as $champKey) {
                if (!isset($seasonChampions[$champKey])) continue;
                foreach ($seasonChampions[$champKey] as &$sc) {
                    $info = $masteryMap[$sc['championName']] ?? null;
                    $sc['masteryLevel']  = $info['level'] ?? 0;
                    $sc['masteryPoints'] = $info['points'] ?? 0;
                }
                unset($sc);
            }
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // Sezon verileri boşsa recentMatches'tan fallback
        if (empty($seasonChampions['all'] ?? []) && !empty($recentMatches)) {
            $seasonChampions = $this->buildChampionFallback($recentMatches);
        }
        if (empty($seasonRoles['all'] ?? []) && !empty($recentStats['roleStats'] ?? [])) {
            $seasonRoles = [
                'all'      => $recentStats['roleStats'],
                'solo'     => [],
                'flex'     => [],
                'normal'   => $recentStats['roleStats'],
                'mainRole' => $recentStats['mainRole'] ?? null,
            ];
        }

        // Challenge ortalamaları (DB-only, 0 API isteği)
        $challengeAverages = [];
        try {
            $challengeAverages = $this->match->getChallengeAverages($puuid);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // Duo partner tespiti (DB-only, 0 API isteği)
        $duoPartners = [];
        try {
            $duoPartners = $this->match->getDuoPartners($puuid);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // Kişilik rozetleri (DB-only, 0 API isteği)
        $personalityBadges = [];
        try {
            $personalityBadges = $this->match->getPersonalityBadges($puuid);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // Winrate timeline
        try {
            $winrateTimeline = $this->match->getWinrateTimeline($puuid);
            foreach (['solo', 'flex'] as $q) {
                if (isset($ranked[$q]) && $ranked[$q] && isset($winrateTimeline[$q])) {
                    $ranked[$q]['wins']    = $winrateTimeline[$q]['wins'];
                    $ranked[$q]['losses']  = $winrateTimeline[$q]['losses'];
                    $ranked[$q]['games']   = $winrateTimeline[$q]['games'];
                    $ranked[$q]['winRate'] = $winrateTimeline[$q]['winRate'];
                }
            }
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // LP zaman serisi (Pro tasarım — tahmini, mevcut LP'ye demirli)
        $lpTimeline = [];
        try {
            $lpTimeline = $this->match->getLpTimeline($puuid, $ranked);
        } catch (\Exception $e) {
            if ($e->getCode() === 429) $rateLimited = true;
        }

        // Tahmini MMR — son 20 maçtaki rakip ranklarının ortalaması (cache'li, sınırlı).
        // Rate-limit'i kötüleştirmemek için yalnız henüz limitlenmediysek dene.
        $avgGameRank = null;
        if (!$rateLimited) {
            try {
                $avgGameRank = $this->match->getAvgGameRank($puuid);
            } catch (\Exception $e) {
                if ($e->getCode() === 429) $rateLimited = true;
            }
        }

        // Cooldown cache'den kalan süreyi al
        $cooldown = Cache::get('riot:rate_limit_cooldown');
        $retryAfter = $cooldown ? max(0, $cooldown - time()) : 0;
        if ($retryAfter > 0) $rateLimited = true;

        // DB'ye kaydet — autocomplete için
        try {
            $topChamps = array_map(fn($m) => [
                'name' => $m['championName'], 'image' => $m['championImage'],
            ], array_slice($masteries, 0, 5));

            CachedPlayer::updateOrCreate(
                ['puuid' => $puuid],
                [
                    'game_name'      => $profile['gameName'],
                    'tag_line'       => $profile['tagLine'],
                    'tier'           => $ranked['solo']['tier'] ?? null,
                    'rank'           => $ranked['solo']['rank'] ?? null,
                    'queue'          => 'RANKED_SOLO_5x5',
                    'lp'             => $ranked['solo']['lp'] ?? 0,
                    'wins'           => $ranked['solo']['wins'] ?? 0,
                    'losses'         => $ranked['solo']['losses'] ?? 0,
                    'top_champions'  => $topChamps,
                    'top_roles'      => $recentStats['roleStats'] ?? null,
                    'profile_icon_id' => $profile['profileIconId'],
                    'summoner_level' => $profile['summonerLevel'],
                ]
            );
        } catch (\Exception $e) {}

        return response()->json([
            'profile'          => $profile,
            'ranked'           => $ranked,
            'masteries'        => $masteries,
            'totalScore'       => $totalScore,
            'recentMatches'    => $recentMatches,
            'recentStats'      => $recentStats,
            'seasonRoles'      => $seasonRoles,
            'seasonChampions'   => $seasonChampions,
            'totalSeasonMatches' => $totalSeasonMatches,
            'winrateTimeline'   => $winrateTimeline ?? [],
            'lpTimeline'        => $lpTimeline ?? [],
            'avgGameRank'       => $avgGameRank,
            'bannerChampion'    => $bannerChampion,
            'bannerSkins'       => $bannerSkins,
            'challengeAverages'  => $challengeAverages,
            'duoPartners'        => $duoPartners,
            'personalityBadges'  => $personalityBadges,
            'rateLimited'        => $rateLimited,
            'retryAfter'         => $retryAfter,
        ]);
    }

    /**
     * Autocomplete — DB'den oyuncu önerisi.
     * GET /api/v1/summoner/autocomplete?q=elw
     */
    public function autocomplete(Request $request): JsonResponse
    {
        $q = $request->query('q', '');
        $tag = $request->query('tag', '');

        if (strlen($q) < 1) {
            return response()->json([]);
        }

        $query = CachedPlayer::where('game_name', 'LIKE', "{$q}%");

        // Tag varsa filtrele
        if ($tag) {
            $query->where('tag_line', 'LIKE', "{$tag}%");
        }

        $players = $query
            ->limit(5)
            ->get()
            ->map(fn($p) => [
                'puuid'       => $p->puuid,
                'gameName'    => $p->game_name,
                'tagLine'     => $p->tag_line,
                'profileIcon' => $p->profile_icon_id
                    ? $this->ddragon->profileIconUrl($p->profile_icon_id)
                    : null,
                'tier'        => $p->tier,
                'rank'        => $p->rank,
                'lp'          => $p->lp,
                'topRoles'    => $p->top_roles ? array_slice($p->top_roles, 0, 2) : null,
            ]);

        return response()->json($players);
    }

    /**
     * recentMatches'tan şampiyon istatistikleri oluştur (sezon verileri boşsa fallback).
     */
    private function buildChampionFallback(array $matches): array
    {
        $champData = [];
        foreach ($matches as $m) {
            $name = $m['champion']['name'] ?? null;
            if (!$name) continue;
            if (!isset($champData[$name])) {
                $champData[$name] = [
                    'games' => 0, 'wins' => 0,
                    'kills' => 0, 'deaths' => 0, 'assists' => 0,
                    'image' => $m['champion']['image'] ?? '',
                ];
            }
            $champData[$name]['games']++;
            if ($m['win']) $champData[$name]['wins']++;
            $champData[$name]['kills']   += $m['kills'];
            $champData[$name]['deaths']  += $m['deaths'];
            $champData[$name]['assists'] += $m['assists'];
        }

        uasort($champData, fn($a, $b) => $b['games'] <=> $a['games']);

        $list = [];
        foreach ($champData as $name => $d) {
            $g = $d['games'];
            $list[] = [
                'championName'  => $name,
                'championImage' => $d['image'],
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

        return ['all' => $list, 'ranked' => [], 'normal' => $list];
    }

}
