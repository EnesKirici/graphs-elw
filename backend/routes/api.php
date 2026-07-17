<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ChampionController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\SummonerController;
use App\Http\Controllers\Api\LiveGameController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\SettingsController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Tüm route'lar /api/ prefix'i ile gelir.
| Örnek: Route::get('/v1/champions', ...) → http://localhost:8000/api/v1/champions
|
*/

Route::prefix('v1')->group(function () {

    // Test endpoint
    Route::get('/ping', function () {
        return response()->json([
            'status' => 'ok',
            'message' => 'Graphs API is running!',
        ]);
    });

    // Rate limit debug endpoint — sadece local'de açık
    if (app()->environment('local')) {
        Route::get('/debug/rate-limit', function () {
            return response()->json(
                \App\Services\RiotApi\RiotApiService::getRateLimitStatus()
            );
        });
    }

    // DDragon versiyon bilgisi
    Route::get('/version', [ChampionController::class, 'version']);

    // Meta / Dashboard endpoint'leri
    Route::get('/meta/dashboard', [MetaController::class, 'dashboard']);
    Route::get('/meta/rotation', [MetaController::class, 'rotation']);
    Route::get('/meta/stats', [MetaController::class, 'stats']);
    Route::get('/meta/tier-list', [MetaController::class, 'tierList']);

    // Oyuncu endpoint'leri
    Route::get('/summoner/autocomplete', [SummonerController::class, 'autocomplete']);
    Route::get('/summoner/search', [SummonerController::class, 'search']);
    Route::get('/summoner/{puuid}/matches', [SummonerController::class, 'matches']);
    Route::post('/summoner/{puuid}/refresh', [SummonerController::class, 'refresh']);
    Route::get('/summoner/{puuid}', [SummonerController::class, 'show']);

    // Maç detay
    Route::get('/matches/{matchId}', [SummonerController::class, 'matchDetail']);
    // ELW skor kırılımı (şeffaflık modalı)
    Route::get('/matches/{matchId}/elw/{puuid}', [SummonerController::class, 'elwBreakdown']);

    // Canlı maç (Spectator-V5)
    // Sıralama önemli: search/player {puuid} yakalamasından ÖNCE tanımlanmalı.
    Route::get('/live/search', [LiveGameController::class, 'search']);
    Route::get('/live/player/{puuid}', [LiveGameController::class, 'player']);
    Route::get('/live/{puuid}/status', [LiveGameController::class, 'status']);
    Route::get('/live/{puuid}', [LiveGameController::class, 'activeGame']);

    // Leaderboard
    Route::get('/leaderboard', [LeaderboardController::class, 'index']);

    // Şampiyon endpoint'leri
    Route::get('/runes', [ChampionController::class, 'runes']);
    Route::get('/champions', [ChampionController::class, 'index']);
    Route::get('/champions/{id}', [ChampionController::class, 'show']);

    // Analytics — public (site ziyaretçileri event gönderir)
    Route::post('/analytics/event', [AnalyticsController::class, 'store']);
    Route::post('/analytics/batch', [AnalyticsController::class, 'batch']);

    // Public settings (frontend config)
    Route::get('/settings/public', [SettingsController::class, 'publicSettings']);

    // Admin — login (ban kontrolü + rate limited)
    Route::post('/admin/login', [AdminController::class, 'login']);

    // Admin — korumalı endpoint'ler
    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::post('/logout', [AdminController::class, 'logout']);
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/analytics/searches', [AdminController::class, 'searches']);
        Route::get('/analytics/page-views', [AdminController::class, 'pageViews']);
        Route::get('/analytics/events', [AdminController::class, 'events']);

        Route::get('/labels', [SettingsController::class, 'labels']); // etiket motoru katalog+config
        Route::get('/settings/{key}', [SettingsController::class, 'show']);
        Route::put('/settings/{key}', [SettingsController::class, 'update']);

        // Meta worker (durum + elle tetikleme; ayarlar settings/worker_* üzerinden)
        Route::get('/worker', [\App\Http\Controllers\Api\WorkerController::class, 'status']);
        Route::post('/worker/crawl', [\App\Http\Controllers\Api\WorkerController::class, 'crawl']);
        Route::post('/worker/collect', [\App\Http\Controllers\Api\WorkerController::class, 'collect']);

        // Ban yönetimi
        Route::get('/bans', [AdminController::class, 'bans']);
        Route::post('/bans', [AdminController::class, 'banIp']);
        Route::delete('/bans/{id}', [AdminController::class, 'unbanIp']);
        Route::delete('/ban-alerts', [AdminController::class, 'clearAlerts']);
    });

});
