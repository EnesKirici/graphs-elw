<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\BannedIp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class AdminController extends Controller
{
    /**
     * Admin girişi — şifre doğrula, token dön.
     * POST /api/v1/admin/login
     */
    public function login(Request $request): JsonResponse
    {
        $ip = $request->ip();
        $key = 'admin-login:' . $ip;

        // Başarısız deneme sayısını takip et
        $failKey = 'admin-fail-count:' . $ip;
        $failCount = (int) Cache::get($failKey, 0);

        // 10 başarısız deneme → kalıcı ban, taviz yok
        if ($failCount >= 10) {
            BannedIp::ban($ip, "Brute force: {$failCount} basarisiz login denemesi", 0, true);
            Cache::forget($failKey);

            return response()->json([
                'error' => 'IP adresiniz kalıcı olarak engellenmiştir.',
            ], 403);
        }

        // Rate limiting (kısa vadeli — 5 deneme / 5 dakika)
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'error' => "Çok fazla deneme. {$seconds} saniye sonra tekrar deneyin.",
            ], 429);
        }

        RateLimiter::hit($key, 300);

        $password = $request->input('password');

        if (!$password || $password !== config('admin.password')) {
            // Başarısız deneme sayacını artır (24 saat TTL)
            Cache::put($failKey, $failCount + 1, 86400);

            return response()->json(['error' => 'Geçersiz şifre.'], 401);
        }

        // Başarılı giriş — sayaçları temizle
        RateLimiter::clear($key);
        Cache::forget($failKey);

        return response()->json([
            'token' => config('admin.token'),
        ]);
    }

    /**
     * Dashboard özet istatistikleri.
     * GET /api/v1/admin/dashboard
     */
    public function dashboard(): JsonResponse
    {
        $today = AnalyticsEvent::today();
        $week  = AnalyticsEvent::lastDays(7);
        $month = AnalyticsEvent::lastDays(30);

        // Unique session sayıları
        $sessionsToday = (clone $today)->distinct()->count('session_id');
        $sessionsWeek  = (clone $week)->distinct()->count('session_id');
        $sessionsMonth = (clone $month)->distinct()->count('session_id');

        // Toplam event sayıları
        $eventsToday = (clone $today)->count();
        $eventsWeek  = (clone $week)->count();

        // Bugünkü aramalar
        $searchesToday = (clone $today)->ofType('search')->count();

        // En çok aranan profiller (son 7 gün)
        $topSearches = AnalyticsEvent::ofType('search')
            ->lastDays(7)
            ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(data, '$.query')) as query, count(*) as cnt")
            ->groupByRaw("JSON_UNQUOTE(JSON_EXTRACT(data, '$.query'))")
            ->orderByDesc('cnt')
            ->limit(10)
            ->get();

        // En çok ziyaret edilen sayfalar (son 7 gün)
        $topPages = AnalyticsEvent::ofType('page_view')
            ->lastDays(7)
            ->select('page', DB::raw('count(*) as cnt'))
            ->whereNotNull('page')
            ->groupBy('page')
            ->orderByDesc('cnt')
            ->limit(10)
            ->get();

        // Ortalama session süresi (son 7 gün)
        $avgDuration = AnalyticsEvent::ofType('session_end')
            ->lastDays(7)
            ->selectRaw("AVG(JSON_EXTRACT(data, '$.duration_seconds')) as avg_duration")
            ->value('avg_duration');

        // Günlük ziyaretçi trendi (son 7 gün)
        $dailyTrend = AnalyticsEvent::lastDays(7)
            ->selectRaw("DATE(created_at) as date, COUNT(DISTINCT session_id) as sessions")
            ->groupByRaw("DATE(created_at)")
            ->orderBy('date')
            ->get();

        // Aktif ban sayısı
        $activeBans = BannedIp::whereNull('unbanned_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->count();

        return response()->json([
            'sessions' => [
                'today' => $sessionsToday,
                'week'  => $sessionsWeek,
                'month' => $sessionsMonth,
            ],
            'events' => [
                'today' => $eventsToday,
                'week'  => $eventsWeek,
            ],
            'activeBans'    => $activeBans,
            'banAlerts'     => Cache::get('ban_alerts', []),
            'searchesToday' => $searchesToday,
            'topSearches'   => $topSearches,
            'topPages'      => $topPages,
            'avgDuration'   => round((float) $avgDuration),
            'dailyTrend'    => $dailyTrend,
        ]);
    }

    /**
     * Arama geçmişi (sayfalı).
     * GET /api/v1/admin/analytics/searches
     */
    public function searches(Request $request): JsonResponse
    {
        $query = AnalyticsEvent::ofType('search')->orderByDesc('created_at');

        if ($from = $request->query('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('created_at', '<=', $to . ' 23:59:59');
        }

        $perPage = min((int) $request->query('per_page', 20), 100);
        $results = $query->paginate($perPage);

        return response()->json($results);
    }

    /**
     * Sayfa görüntülemeleri.
     * GET /api/v1/admin/analytics/page-views
     */
    public function pageViews(Request $request): JsonResponse
    {
        $days = min((int) $request->query('days', 7), 90);

        $views = AnalyticsEvent::ofType('page_view')
            ->lastDays($days)
            ->select('page', DB::raw('count(*) as views'), DB::raw('COUNT(DISTINCT session_id) as unique_views'))
            ->whereNotNull('page')
            ->groupBy('page')
            ->orderByDesc('views')
            ->limit(50)
            ->get();

        // Günlük dağılım
        $daily = AnalyticsEvent::ofType('page_view')
            ->lastDays($days)
            ->selectRaw("DATE(created_at) as date, count(*) as views")
            ->groupByRaw("DATE(created_at)")
            ->orderBy('date')
            ->get();

        return response()->json([
            'pages' => $views,
            'daily' => $daily,
        ]);
    }

    /**
     * Tıklama olayları.
     * GET /api/v1/admin/analytics/events
     */
    public function events(Request $request): JsonResponse
    {
        $type = $request->query('type', 'click');
        $perPage = min((int) $request->query('per_page', 20), 100);

        $results = AnalyticsEvent::ofType($type)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($results);
    }

    /**
     * Banlı IP listesi.
     * GET /api/v1/admin/bans
     */
    public function bans(Request $request): JsonResponse
    {
        $filter = $request->query('filter', 'active'); // active, expired, all

        $query = BannedIp::orderByDesc('banned_at');

        if ($filter === 'active') {
            $query->whereNull('unbanned_at')
                  ->where(function ($q) {
                      $q->where('is_permanent', true)
                        ->orWhere('expires_at', '>', now());
                  });
        } elseif ($filter === 'expired') {
            $query->where(function ($q) {
                $q->whereNotNull('unbanned_at')
                  ->orWhere(function ($q2) {
                      $q2->where('is_permanent', false)
                         ->where('expires_at', '<=', now());
                  });
            });
        }

        $perPage = min((int) $request->query('per_page', 20), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * Manuel IP banlama.
     * POST /api/v1/admin/bans
     */
    public function banIp(Request $request): JsonResponse
    {
        $request->validate([
            'ip_address' => 'required|string|max:45',
            'reason'     => 'required|string|max:255',
            'minutes'    => 'nullable|integer|min:1',
            'permanent'  => 'nullable|boolean',
        ]);

        $ban = BannedIp::ban(
            $request->input('ip_address'),
            $request->input('reason'),
            $request->input('minutes', 60),
            $request->boolean('permanent', false)
        );

        return response()->json(['ok' => true, 'ban' => $ban]);
    }

    /**
     * IP banını kaldır.
     * DELETE /api/v1/admin/bans/{id}
     */
    public function unbanIp(int $id): JsonResponse
    {
        $ban = BannedIp::findOrFail($id);
        $ban->update(['unbanned_at' => now()]);

        return response()->json(['ok' => true]);
    }

    /**
     * Ban bildirimlerini temizle.
     * DELETE /api/v1/admin/ban-alerts
     */
    public function clearAlerts(): JsonResponse
    {
        Cache::forget('ban_alerts');
        return response()->json(['ok' => true]);
    }
}
