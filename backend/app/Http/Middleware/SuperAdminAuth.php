<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 'admin' middleware'inden SONRA çalışır — kullanıcı zaten doğrulanmıştır,
 * burada yalnız rolüne bakılır.
 */
class SuperAdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->role !== 'super_admin') {
            return response()->json(['error' => 'Bu işlem için süper admin yetkisi gerekir.'], 403);
        }

        return $next($request);
    }
}
