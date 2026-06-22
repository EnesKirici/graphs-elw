<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Cache;

/**
 * Spectator-V5 servisi — canlı (aktif) oyun verisi.
 *
 * Riot Spectator API'si oyuncunun o an oynadığı maçın "loading/oyun içi"
 * anlık görüntüsünü verir: 10 oyuncunun şampiyonu, spell'i, rünü, ban'lar.
 *
 * 404 = oyuncu şu anda oyunda değil. Bu durumu da kısa süre cache'leriz ki
 * "oyunda değil" cevabı her seferinde Riot'a istek atmasın (yeşil tık kontrolü).
 */
class SpectatorService
{
    private const OFFLINE = 'OFFLINE';

    public function __construct(
        private RiotApiService $api,
    ) {}

    /**
     * Oyuncunun aktif oyununu getir. Oyunda değilse null döner.
     * 30sn cache (config('riot.cache_ttl.live_game')).
     *
     * Not: Cache::remember null'ı cache'lemez; "OFFLINE" sentinel ile
     * negatif sonucu da cache'liyoruz (rate-limit'i korumak için).
     */
    public function getActiveGame(string $puuid): ?array
    {
        $cacheKey = "spectator:active:{$puuid}";
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached === self::OFFLINE ? null : $cached;
        }

        try {
            $game = $this->api->platformRequest(
                "/lol/spectator/v5/active-games/by-summoner/{$puuid}"
            );
            Cache::put($cacheKey, $game, config('riot.cache_ttl.live_game'));
            return $game;
        } catch (\Exception $e) {
            // 404 → oyunda değil (negatif sonucu cache'le)
            if ($e->getCode() === 404) {
                Cache::put($cacheKey, self::OFFLINE, config('riot.cache_ttl.live_game'));
                return null;
            }
            // 429 / diğer hatalar yukarı fırlatılır (controller ele alır)
            throw $e;
        }
    }

    /**
     * Sadece "oyunda mı?" — profil sayfasındaki yeşil tık için.
     */
    public function isInGame(string $puuid): bool
    {
        return $this->getActiveGame($puuid) !== null;
    }

    /**
     * Öne çıkan canlı oyunlar — geliştirme/test için kullanışlı
     * (gerçekten oyunda olan bir puuid bulup uçtan uca test etmek için).
     */
    public function getFeaturedGames(): array
    {
        return Cache::remember('spectator:featured', config('riot.cache_ttl.live_game'), function () {
            return $this->api->platformRequest('/lol/spectator/v5/featured-games');
        });
    }
}
