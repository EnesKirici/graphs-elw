<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // 'api' rate limiter'ını tüm API route'larına uygular (AppServiceProvider'da tanımlı)
        $middleware->throttleApi();

        $middleware->api(append: [
            \App\Http\Middleware\CheckBan::class,
        ]);

        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminAuth::class,
            'admin.super' => \App\Http\Middleware\SuperAdminAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API istekleri Accept header'ı göndermese bile hata yanıtları JSON olsun —
        // yoksa Laravel validasyon hatasında redirect atar, tarayıcıda CORS hatası görünür.
        $exceptions->shouldRenderJsonWhen(
            fn ($request, $e) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
