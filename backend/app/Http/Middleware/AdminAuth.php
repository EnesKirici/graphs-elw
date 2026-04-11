<?php

namespace App\Http\Middleware;

use App\Models\AdminUser;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['error' => 'Yetkisiz erişim.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);

        if (!$accessToken || $accessToken->tokenable_type !== AdminUser::class) {
            return response()->json(['error' => 'Yetkisiz erişim.'], 401);
        }

        // Token süresi dolmuş mu?
        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            $accessToken->delete();
            return response()->json(['error' => 'Oturum süresi doldu.'], 401);
        }

        // Request'e kullanıcıyı bağla
        $request->setUserResolver(fn () => $accessToken->tokenable);

        return $next($request);
    }
}
