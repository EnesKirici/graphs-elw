<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CachedPlayer;
use App\Services\RiotApi\SummonerService;
use App\Services\RiotApi\LeagueService;
use App\Services\RiotApi\ChampionMasteryService;
use App\Services\RiotApi\MatchService;
use App\Services\RiotApi\MatchDataService;
use App\Services\RiotApi\DataDragonService;
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

        $ranked = $this->league->getRankedInfo($puuid);
        $masteries = $this->mastery->getTopMasteries($puuid, 10);
        $totalScore = $this->mastery->getTotalScore($puuid);

        // Tüm sezon maç ID'lerini topla ve toplu paralel preload yap
        // Bu sayede sonraki getMatchDetail çağrıları cache'den dönecek
        try {
            $allSeasonIds = [];
            foreach ([420, 440, 400, 430, 490] as $queueId) {
                try {
                    $ids = $this->matchData->getSeasonMatchIds($puuid, $queueId);
                    $allSeasonIds = array_merge($allSeasonIds, $ids);
                } catch (\Exception $e) {}
            }
            // Recent match ID'lerini de ekle
            $recentIds = $this->matchData->getMatchIds($puuid, 10, 0);
            $allSeasonIds = array_unique(array_merge($allSeasonIds, $recentIds));

            // Tümünü paralel indir (cache'de olmayanlar)
            $this->matchData->preloadMatchDetails($allSeasonIds);
        } catch (\Exception $e) {}

        // Maç geçmişi + sezon koridor verisi + sezon şampiyon istatistikleri
        $recentMatches = [];
        $recentStats = null;
        $seasonRoles = null;
        $seasonChampions = [];
        $winrateTimeline = [];
        $bannerSplash = null;
        try {
            $recentMatches = $this->match->getRecentMatches($puuid, 10);
            $recentStats = $this->match->calculateRecentStats($recentMatches, $puuid);
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

            if ($recentStats['mostPlayedChampion'] ?? null) {
                $bannerSplash = $this->ddragon->splashArtUrl($recentStats['mostPlayedChampion']['id']);
            }
        } catch (\Exception $e) {}

        // Winrate timeline — tek kaynak: sezon W/L verileri buradan türetilir
        try {
            $winrateTimeline = $this->match->getWinrateTimeline($puuid);

            // Ranked W/L/WR'yi timeline verisinden al (tek kaynak)
            foreach (['solo', 'flex'] as $q) {
                if (isset($ranked[$q]) && $ranked[$q] && isset($winrateTimeline[$q])) {
                    $ranked[$q]['wins']    = $winrateTimeline[$q]['wins'];
                    $ranked[$q]['losses']  = $winrateTimeline[$q]['losses'];
                    $ranked[$q]['games']   = $winrateTimeline[$q]['games'];
                    $ranked[$q]['winRate'] = $winrateTimeline[$q]['winRate'];
                }
            }
        } catch (\Exception $e) {}

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
            'winrateTimeline'   => $winrateTimeline ?? [],
            'bannerSplash'      => $bannerSplash,
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
}
