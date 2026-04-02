<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ChampionController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\SummonerController;
use App\Http\Controllers\Api\LeaderboardController;

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

    // DDragon versiyon bilgisi
    Route::get('/version', [ChampionController::class, 'version']);

    // Meta / Dashboard endpoint'leri
    Route::get('/meta/dashboard', [MetaController::class, 'dashboard']);
    Route::get('/meta/rotation', [MetaController::class, 'rotation']);

    // Oyuncu endpoint'leri
    Route::get('/summoner/autocomplete', [SummonerController::class, 'autocomplete']);
    Route::get('/summoner/search', [SummonerController::class, 'search']);
    Route::get('/summoner/{puuid}/matches', [SummonerController::class, 'matches']);
    Route::get('/summoner/{puuid}', [SummonerController::class, 'show']);

    // Maç detay
    Route::get('/matches/{matchId}', [SummonerController::class, 'matchDetail']);

    // Leaderboard
    Route::get('/leaderboard', [LeaderboardController::class, 'index']);

    // Şampiyon endpoint'leri
    Route::get('/champions', [ChampionController::class, 'index']);
    Route::get('/champions/{id}', [ChampionController::class, 'show']);

});
