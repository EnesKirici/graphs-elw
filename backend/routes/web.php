<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    // API kök adresi indekslenmesin diye ana siteye 301 — Google'a düşen
    // Laravel "welcome" sayfası sorununu bitirir. Gerçek uçlar (/api/*) etkilenmez.
    $site = trim(explode(',', (string) env('FRONTEND_URL', 'https://elwgraphs.com'))[0]);

    return redirect($site !== '' ? $site : 'https://elwgraphs.com', 301)
        ->header('X-Robots-Tag', 'noindex');
});
