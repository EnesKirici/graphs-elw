<?php

namespace App\Services\RiotApi;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

/**
 * Data Dragon (DDragon) servisi.
 *
 * DDragon, Riot'un CDN'i. Şampiyon isimleri, görselleri, item bilgileri gibi
 * statik verileri sunar. API key gerektirmez.
 *
 * URL yapısı: https://ddragon.leagueoflegends.com/cdn/{version}/data/{lang}/champion.json
 */
class DataDragonService
{
    private string $baseUrl;
    private string $lang = 'tr_TR';

    public function __construct()
    {
        $this->baseUrl = config('riot.ddragon_url');
    }

    /**
     * Güncel patch versiyonunu getir.
     * Örnek: "15.6.1"
     */
    public function getCurrentVersion(): string
    {
        return Cache::remember('ddragon:version', 3600, function () {
            $versions = Http::get("{$this->baseUrl}/api/versions.json")->json();
            return $versions[0]; // İlk eleman = en güncel versiyon
        });
    }

    /**
     * Tüm şampiyonların listesini getir.
     * 24 saat cache'lenir çünkü sadece yeni patch'te değişir.
     */
    public function getChampions(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:champions', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/champion.json")->json();
            return $data['data'];
        });
    }

    /**
     * Tek bir şampiyonun detaylı bilgisini getir (skill'ler, lore, istatistikler).
     */
    public function getChampionDetail(string $championName): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember("ddragon:champion:{$championName}", config('riot.cache_ttl.ddragon'), function () use ($version, $championName) {
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/champion/{$championName}.json")->json();
            return $data['data'][$championName];
        });
    }

    /**
     * Tüm item verilerini getir.
     */
    public function getItems(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:items', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/item.json")->json();
            return $data['data'];
        });
    }

    /**
     * Summoner spell verilerini getir.
     */
    public function getSummonerSpells(): array
    {
        $version = $this->getCurrentVersion();

        return Cache::remember('ddragon:spells', config('riot.cache_ttl.ddragon'), function () use ($version) {
            $data = Http::get("{$this->baseUrl}/cdn/{$version}/data/{$this->lang}/summoner.json")->json();
            return $data['data'];
        });
    }

    /**
     * Görsel URL'leri oluşturmak için helper method'lar.
     */
    public function championIconUrl(string $championName): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->baseUrl}/cdn/{$version}/img/champion/{$championName}.png";
    }

    public function itemIconUrl(int $itemId): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->baseUrl}/cdn/{$version}/img/item/{$itemId}.png";
    }

    public function profileIconUrl(int $iconId): string
    {
        $version = $this->getCurrentVersion();
        return "{$this->baseUrl}/cdn/{$version}/img/profileicon/{$iconId}.png";
    }

    public function splashArtUrl(string $championName, int $skinNum = 0): string
    {
        return "{$this->baseUrl}/cdn/img/champion/splash/{$championName}_{$skinNum}.jpg";
    }

    public function loadingScreenUrl(string $championName, int $skinNum = 0): string
    {
        return "{$this->baseUrl}/cdn/img/champion/loading/{$championName}_{$skinNum}.jpg";
    }
}
