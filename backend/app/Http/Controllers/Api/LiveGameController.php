<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RiotApi\LiveGameService;
use App\Services\RiotApi\SummonerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Canlı (aktif) maç endpoint'leri.
 *
 *   GET /api/v1/live/search?name=&tag=  → name/tag çöz, aktif oyunu döndür
 *   GET /api/v1/live/{puuid}            → HIZLI: zenginleştirilmiş aktif oyun
 *   GET /api/v1/live/player/{puuid}     → AĞIR: oyuncunun son-maç türevli verisi (progresif)
 *   GET /api/v1/live/{puuid}/status     → {inGame: bool} (profil yeşil tıkı)
 */
class LiveGameController extends Controller
{
    public function __construct(
        private LiveGameService $live,
        private SummonerService $summoner,
    ) {}

    /**
     * name/tag ile arar, puuid'i çözüp aktif oyunu döndürür (sayfa SSR'ı için).
     */
    public function search(Request $request): JsonResponse
    {
        $name = $request->query('name');
        $tag = $request->query('tag');

        if (!$name || !$tag) {
            return response()->json(['error' => 'name ve tag parametreleri gerekli.'], 400);
        }

        try {
            $profile = $this->summoner->searchByRiotId($name, $tag);
            return $this->respondActiveGame($profile['puuid'], $profile);
        } catch (\Exception $e) {
            return $this->errorResponse($e, "Oyuncu bulunamadı: {$name}#{$tag}");
        }
    }

    /**
     * HIZLI: puuid ile aktif oyun. Oyunda değilse 404 + {status: offline}.
     */
    public function activeGame(string $puuid): JsonResponse
    {
        return $this->respondActiveGame($puuid, null);
    }

    /**
     * AĞIR: oyuncunun son maçlarından türetilen veri (rozet, son maçlar, build).
     * Hata olsa bile 200 döner ki progresif UI zarifçe bozulmadan devam etsin.
     */
    public function player(string $puuid, Request $request): JsonResponse
    {
        $champion = $request->query('champion');
        try {
            return response()->json($this->live->getPlayerEnrichment($puuid, $champion));
        } catch (\Exception $e) {
            return response()->json([
                'puuid' => $puuid,
                'error' => $e->getCode() === 429 ? 'rate_limited' : 'failed',
                'playstyleBadges' => [],
                'recentGames' => [],
            ]);
        }
    }

    /**
     * Profil sayfasındaki "oyunda" yeşil tıkı için hafif kontrol.
     */
    public function status(string $puuid): JsonResponse
    {
        try {
            return response()->json(['inGame' => $this->live->isInGame($puuid)]);
        } catch (\Exception $e) {
            return response()->json(['inGame' => false]);
        }
    }

    // ────────────────────────────────────────────

    private function respondActiveGame(string $puuid, ?array $profile): JsonResponse
    {
        try {
            $game = $this->live->getActiveGame($puuid);
            if (!$game) {
                return response()->json([
                    'status'  => 'offline',
                    'puuid'   => $puuid,
                    'profile' => $profile,
                ], 404);
            }
            if ($profile) {
                $game['profile'] = $profile;
            }
            return response()->json($game);
        } catch (\Exception $e) {
            return $this->errorResponse($e, 'Canlı maç verisi alınamadı.');
        }
    }

    private function errorResponse(\Exception $e, string $notFoundMessage): JsonResponse
    {
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
            'error' => $code === 404 ? $notFoundMessage : $e->getMessage(),
        ], $code >= 100 && $code < 600 ? $code : 500);
    }
}
