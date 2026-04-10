<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\BannedIp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CheckBan
{
    // Dakika başı istek limiti
    private const RATE_LIMIT = 120;
    // Bu limitin kaç katı = kalıcı ban
    private const BAN_MULTIPLIER = 3;

    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip();

        // 1. Banlı mı kontrol et
        $ban = BannedIp::getActiveBan($ip);
        if ($ban) {
            return response()->json([
                'error'     => 'Bu IP adresi engellenmiştir.',
                'reason'    => $ban->reason,
                'permanent' => $ban->is_permanent,
            ], 403);
        }

        // 2. İstek sayacı — dakika başı
        $key = 'req_count:' . $ip;
        $count = (int) Cache::get($key, 0);
        $count++;
        Cache::put($key, $count, 60);

        // 3. Limit aşımı → otomatik ban
        if ($count > self::RATE_LIMIT * self::BAN_MULTIPLIER) {
            // 3x limit = kalıcı ban (agresif bot)
            BannedIp::ban($ip, "Bot: dakikada {$count} istek (kalici)", 0, true);
            return response()->json(['error' => 'IP kalıcı olarak engellendi.'], 403);
        }

        if ($count > self::RATE_LIMIT) {
            // 1x limit = 1 saat ban (ilk uyarı)
            BannedIp::ban($ip, "Rate limit: dakikada {$count} istek", 60);
            return response()->json(['error' => 'Çok fazla istek. IP geçici olarak engellendi.'], 429);
        }

        return $next($request);
    }
}
