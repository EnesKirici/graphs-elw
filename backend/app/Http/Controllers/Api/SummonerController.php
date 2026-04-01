<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RiotApi\SummonerService;
use App\Services\RiotApi\LeagueService;
use App\Services\RiotApi\ChampionMasteryService;
use App\Services\RiotApi\MatchService;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SummonerController extends Controller
{
    public function __construct(
        private SummonerService $summoner,
        private LeagueService $league,
        private ChampionMasteryService $mastery,
        private MatchService $match,
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

    private function buildFullResponse(array $profile): JsonResponse
    {
        $puuid = $profile['puuid'];

        $ranked = $this->league->getRankedInfo($puuid);
        $masteries = $this->mastery->getTopMasteries($puuid, 10);
        $totalScore = $this->mastery->getTotalScore($puuid);

        // Maç geçmişi + sezon koridor verisi
        $recentMatches = [];
        $recentStats = null;
        $seasonRoles = null;
        $bannerSplash = null;
        try {
            $recentMatches = $this->match->getRecentMatches($puuid, 10);
            $recentStats = $this->match->calculateRecentStats($recentMatches, $puuid);
            $seasonRoles = $this->match->getSeasonRoleStats($puuid);

            if ($recentStats['mostPlayedChampion'] ?? null) {
                $bannerSplash = $this->ddragon->splashArtUrl($recentStats['mostPlayedChampion']['id']);
            }
        } catch (\Exception $e) {}

        return response()->json([
            'profile'       => $profile,
            'ranked'        => $ranked,
            'masteries'     => $masteries,
            'totalScore'    => $totalScore,
            'recentMatches' => $recentMatches,
            'recentStats'   => $recentStats,
            'seasonRoles'   => $seasonRoles,
            'bannerSplash'  => $bannerSplash,
        ]);
    }
}
