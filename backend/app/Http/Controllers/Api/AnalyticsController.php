<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    /**
     * Tekil event kaydet.
     * POST /api/v1/analytics/event
     */
    public function store(Request $request): JsonResponse
    {
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
        $validated = $request->validate([
            'events'              => 'required|array|max:50',
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
}
