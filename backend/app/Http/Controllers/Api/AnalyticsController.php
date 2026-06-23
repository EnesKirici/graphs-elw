<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\BannedIp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AnalyticsController extends Controller
{
    /**
     * Tekil event kaydet.
     * POST /api/v1/analytics/event
     */
    public function store(Request $request): JsonResponse
    {
        if ($this->isAbuse($request)) {
            // Rate-limit aşıldı → event'i sessizce düş (ban yok, hata yok)
            return response()->json(['ok' => true, 'dropped' => true]);
        }

        $validated = $request->validate([
            'type'       => 'required|string|in:page_view,search,click,session_end',
            'page'       => 'nullable|string|max:255',
            'data'       => 'nullable|array',
            'session_id' => 'required|string|max:64',
        ]);

        AnalyticsEvent::create([
            ...$validated,
            'ip_address' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?? '', 0, 500),
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * Toplu event kaydet.
     * POST /api/v1/analytics/batch
     */
    public function batch(Request $request): JsonResponse
    {
        if ($this->isAbuse($request)) {
            // Rate-limit aşıldı → event'i sessizce düş (ban yok, hata yok)
            return response()->json(['ok' => true, 'dropped' => true]);
        }

        $validated = $request->validate([
            'events'              => 'required|array|max:20',
            'events.*.type'       => 'required|string|in:page_view,search,click,session_end',
            'events.*.page'       => 'nullable|string|max:255',
            'events.*.data'       => 'nullable|array',
            'events.*.session_id' => 'required|string|max:64',
        ]);

        $ip = $request->ip();
        $ua = substr($request->userAgent() ?? '', 0, 500);

        $rows = array_map(fn($e) => [
            'type'       => $e['type'],
            'page'       => $e['page'] ?? null,
            'data'       => isset($e['data']) ? json_encode($e['data']) : null,
            'session_id' => $e['session_id'],
            'ip_address' => $ip,
            'user_agent' => $ua,
            'created_at' => now(),
        ], $validated['events']);

        AnalyticsEvent::insert($rows);

        return response()->json(['ok' => true, 'count' => count($rows)]);
    }

    /**
     * Analytics rate-limit — IP başına dakikada max 200 istek. Aşılırsa event
     * sessizce düşer. BANLAMAZ (gerçek kullanıcı normal gezerken banlanmasın diye).
     */
    private function isAbuse(Request $request): bool
    {
        $ip = $request->ip();
        $key = 'analytics_rate:' . $ip;
        $count = (int) Cache::get($key, 0) + 1;
        Cache::put($key, $count, 60);

        // Analytics'i SADECE sınırla — BANLAMA. Gerçek kullanıcı normal gezerken de
        // event üretir; banlamak tüm siteyi kilitlerdi (kullanıcı kendini banlıyordu).
        // Eşik aşılırsa event sessizce düşer.
        return $count > 200;
    }
}
