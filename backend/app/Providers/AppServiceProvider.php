<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // API hız limiti — ayarlar config/elwgraphs.php 'api_throttle'.
        // Sunucunun kendi istekleri (SSR/worker) muaf; diğer her IP saniye+dakika
        // kovalarına tabidir. Aşımda Laravel otomatik 429 döner.
        RateLimiter::for('api', function (Request $request) {
            $cfg = config('elwgraphs.api_throttle');

            if (in_array($request->ip(), $cfg['trusted_ips'], true)) {
                return Limit::none();
            }

            return [
                Limit::perSecond($cfg['per_second'])->by($request->ip()),
                Limit::perMinute($cfg['per_minute'])->by($request->ip()),
            ];
        });
    }
}
