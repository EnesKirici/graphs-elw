<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token || $token !== config('admin.token')) {
            return response()->json(['error' => 'Yetkisiz erişim.'], 401);
        }

        return $next($request);
    }
}
