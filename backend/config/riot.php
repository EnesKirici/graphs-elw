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

    // Küçük ikonlar (item/şampiyon karesi/spell/passive/rün) için asset tabanı.
    // assets:sync bu ikonları frontend/public/dd altına indirir; prod'da
    // DDRAGON_ASSETS_URL=https://elwgraphs.elw.com.tr/dd ile yerelden servis edilir.
    // Ayarsızsa doğrudan ddragon'a düşer (local dev ayna gerektirmez).
    'ddragon_assets_url' => env('DDRAGON_ASSETS_URL', 'https://ddragon.leagueoflegends.com'),

    // assets:sync aynasının yazılacağı dizin (Next public → site kökünden /dd).
    'ddragon_mirror_path' => env('DDRAGON_MIRROR_PATH', base_path('../frontend/public/dd')),

    // Cache süreleri (saniye cinsinden)
    'cache_ttl' => [
        'ddragon'      => 86400,   // 24 saat - şampiyon verileri patch ile değişir
        'meta_stats'   => 3600,    // 1 saat - meta istatistikleri
        'summoner'     => 1800,    // 30 dakika - oyuncu profil bilgileri
        'match_ids'    => 600,     // 10 dakika - maç ID listesi (yeni maç oynanabilir)
        'match_detail' => 604800,  // 7 gün - maç detayı (maçlar asla değişmez)
        'live_game'    => 30,      // 30 saniye - canlı oyun verisi
    ],

];
