<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Leaderboard\LeaderboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function __construct(private LeaderboardService $leaderboard) {}

    public function index(Request $request): JsonResponse
    {
        $tier = (string) $request->query('tier', 'challenger');
        $queue = (string) $request->query('queue', 'RANKED_SOLO_5x5');

        if (! in_array($tier, LeaderboardService::TIERS, true)) {
            return response()->json(['error' => 'tier: challenger, grandmaster veya master'], 400);
        }

        // Kuyruk de doğrulanır: doğrulanmamış parametre cache anahtarına giriyordu,
        // yani keyfi ?queue= değerleriyle cache tablosu şişirilebilirdi.
        if (! in_array($queue, LeaderboardService::QUEUES, true)) {
            return response()->json(['error' => 'queue: RANKED_SOLO_5x5 veya RANKED_FLEX_SR'], 400);
        }

        return response()->json($this->leaderboard->get($tier, $queue));
    }
}
