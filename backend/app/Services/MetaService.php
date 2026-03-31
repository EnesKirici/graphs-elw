<?php

namespace App\Services;

use App\Services\RiotApi\DataDragonService;
use App\Services\RiotApi\RiotApiService;
use Illuminate\Support\Facades\Cache;

/**
 * Meta istatistik servisi.
 * Şampiyon win rate, pick rate, ban rate gibi verileri sağlar.
 *
 * Şu an seed data kullanıyor (development API key ile gerçek meta data toplanamaz).
 * Production key alındığında gerçek veriye geçilecek.
 */
class MetaService
{
    public function __construct(
        private DataDragonService $ddragon,
        private RiotApiService $riot,
    ) {}

    /**
     * Ücretsiz şampiyon rotasyonu.
     */
    public function getFreeRotation(): array
    {
        return Cache::remember('meta:free_rotation', 3600, function () {
            return $this->riot->platformRequest('/lol/platform/v3/champion-rotations');
        });
    }

    /**
     * Dashboard için meta istatistikleri.
     * Her şampiyona gerçekçi win/pick/ban rate atar.
     */
    public function getDashboardStats(): array
    {
        return Cache::remember('meta:dashboard_stats', config('riot.cache_ttl.meta_stats'), function () {
            $champions = $this->ddragon->getChampions();
            $version = $this->ddragon->getCurrentVersion();
            $rotation = $this->getFreeRotation();

            $stats = [];
            foreach ($champions as $champ) {
                $key = (int) $champ['key'];

                // Deterministic seed: her şampiyon için sabit ama gerçekçi değerler
                $seed = crc32($champ['id']);
                $winRate = 46 + (($seed % 1000) / 100);        // 46% - 56%
                $pickRate = 1 + (($seed % 500) / 50);           // 1% - 11%
                $banRate = 0.5 + ((($seed >> 4) % 400) / 40);   // 0.5% - 10.5%

                $stats[] = [
                    'id'        => $champ['id'],
                    'key'       => $key,
                    'name'      => $champ['name'],
                    'title'     => $champ['title'],
                    'tags'      => $champ['tags'],
                    'image'     => $this->ddragon->championIconUrl($champ['id']),
                    'splash'    => $this->ddragon->splashArtUrl($champ['id']),
                    'winRate'   => round($winRate, 1),
                    'pickRate'  => round($pickRate, 1),
                    'banRate'   => round($banRate, 1),
                    'tier'      => $this->calculateTier($winRate, $pickRate),
                    'isFree'    => in_array($key, $rotation['freeChampionIds'] ?? []),
                ];
            }

            // Win rate'e göre sırala
            usort($stats, fn($a, $b) => $b['winRate'] <=> $a['winRate']);

            return [
                'version'    => $version,
                'count'      => count($stats),
                'champions'  => $stats,
                'topWinRate' => array_slice($stats, 0, 10),
                'topPickRate' => array_slice(
                    collect($stats)->sortByDesc('pickRate')->values()->all(), 0, 10
                ),
                'topBanRate' => array_slice(
                    collect($stats)->sortByDesc('banRate')->values()->all(), 0, 10
                ),
                'freeRotation' => collect($stats)->where('isFree', true)->values()->all(),
            ];
        });
    }

    /**
     * Tier hesaplama (S, A, B, C, D).
     */
    private function calculateTier(float $winRate, float $pickRate): string
    {
        $score = ($winRate - 50) * 2 + $pickRate;
        if ($score >= 14) return 'S+';
        if ($score >= 10) return 'S';
        if ($score >= 6) return 'A';
        if ($score >= 2) return 'B';
        if ($score >= -2) return 'C';
        return 'D';
    }
}
