<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Laravel'de normalde routes/web.php kullanırsın (Blade sayfaları için).
| Ama biz Next.js kullandığımız için Laravel sadece JSON API sunacak.
| Bu dosyadaki tüm route'lar otomatik olarak /api/ prefix'i alır.
|
| Örnek: Route::get('/v1/champions', ...) → http://localhost:8000/api/v1/champions
|
*/

Route::prefix('v1')->group(function () {

    // Test endpoint - her şeyin çalıştığını doğrulamak için
    Route::get('/ping', function () {
        return response()->json([
            'status' => 'ok',
            'message' => 'Graphs API is running!',
        ]);
    });

});
