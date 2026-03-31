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

    private function buildFullResponse(array $profile): JsonResponse
    {
        $puuid = $profile['puuid'];

        $ranked = $this->league->getRankedInfo($puuid);
        $masteries = $this->mastery->getTopMasteries($puuid, 10);
        $totalScore = $this->mastery->getTotalScore($puuid);

        // Maç geçmişi — rate limit'e takılırsa boş dön
        $recentMatches = [];
        $recentStats = null;
        $bannerSplash = null;
        try {
            $recentMatches = $this->match->getRecentMatches($puuid, 15);
            $recentStats = $this->match->calculateRecentStats($recentMatches, $puuid);

            if ($recentStats['mostPlayedChampion'] ?? null) {
                $bannerSplash = $this->ddragon->splashArtUrl($recentStats['mostPlayedChampion']['id']);
            }
        } catch (\Exception $e) {
            // Rate limit veya match API hatası — profil yine de gösterilsin
        }

        return response()->json([
            'profile'       => $profile,
            'ranked'        => $ranked,
            'masteries'     => $masteries,
            'totalScore'    => $totalScore,
            'recentMatches' => $recentMatches,
            'recentStats'   => $recentStats,
            'bannerSplash'  => $bannerSplash,
        ]);
    }
}
