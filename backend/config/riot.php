<?php

/*
|--------------------------------------------------------------------------
| Riot Games API Yapılandırması
|--------------------------------------------------------------------------
|
| Riot API ile iletişim için gereken tüm ayarlar burada.
|
| İki farklı URL var çünkü Riot API'si iki katmanlı çalışır:
| - Platform URL (tr1): Summoner, League, Mastery, Spectator gibi sunucuya özgü veriler
| - Region URL (europe): Account, Match gibi bölgesel veriler
|
| Türkiye sunucusu (TR1) → Europe bölgesine bağlı.
|
*/

return [

    // Riot Developer Portal'dan aldığın API key
    'api_key' => env('RIOT_API_KEY'),

    // Sunucu kodu (tr1 = Türkiye)
    'platform' => env('RIOT_PLATFORM', 'tr1'),

    // Bölge kodu (europe = Türkiye'nin bağlı olduğu bölge)
    'region' => env('RIOT_REGION', 'europe'),

    // Platform bazlı API URL'si (Summoner, League, Mastery, Spectator)
    'platform_url' => 'https://' . env('RIOT_PLATFORM', 'tr1') . '.api.riotgames.com',

    // Bölge bazlı API URL'si (Account, Match)
    'region_url' => 'https://' . env('RIOT_REGION', 'europe') . '.api.riotgames.com',

    // DDragon CDN - şampiyon görselleri, item görselleri vs.
    'ddragon_url' => 'https://ddragon.leagueoflegends.com',

    // Cache süreleri (saniye cinsinden)
    'cache_ttl' => [
        'ddragon'    => 86400,  // 24 saat - şampiyon verileri patch ile değişir
        'meta_stats' => 3600,   // 1 saat - meta istatistikleri
        'summoner'   => 600,    // 10 dakika - oyuncu bilgileri
        'matches'    => 300,    // 5 dakika - maç geçmişi listesi
        'live_game'  => 30,     // 30 saniye - canlı oyun verisi
    ],

];
