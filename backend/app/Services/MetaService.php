<?php

namespace App\Services;

use App\Services\RiotApi\DataDragonService;
use App\Services\RiotApi\RiotApiService;
use Illuminate\Support\Facades\Cache;

class MetaService
{
    public function __construct(
        private DataDragonService $ddragon,
        private RiotApiService $riot,
    ) {}

    public function getFreeRotation(): array
    {
        return Cache::remember('meta:free_rotation', 3600, function () {
            return $this->riot->platformRequest('/lol/platform/v3/champion-rotations');
        });
    }

    public function getDashboardStats(): array
    {
        return Cache::remember('meta:dashboard_stats_v4', config('riot.cache_ttl.meta_stats'), function () {
            $champions = $this->ddragon->getChampions();
            $version = $this->ddragon->getCurrentVersion();
            $rotation = $this->getFreeRotation();
            $ddragonBase = config('riot.ddragon_url');

            $stats = [];
            foreach ($champions as $champ) {
                $key = (int) $champ['key'];
                $seed = crc32($champ['id']);

                // Geniş ve dağınık değerler — hash tabanlı
                $h1 = abs(crc32($champ['id'] . 'wr'));
                $h2 = abs(crc32($champ['id'] . 'pr'));
                $h3 = abs(crc32($champ['id'] . 'br'));
                $h4 = abs(crc32($champ['id'] . 'ch'));

                $winRate = 44 + ($h1 % 1400) / 100;         // 44.0% - 57.9%
                $pickRate = 1 + ($h2 % 2800) / 100;          // 1.0% - 29.0%
                $banRate = 0.5 + ($h3 % 3500) / 100;         // 0.5% - 35.5%
                $wrChange = round(($h4 % 60 - 30) / 10, 1);  // -3.0 ile +2.9

                $stats[] = [
                    'id'        => $champ['id'],
                    'key'       => $key,
                    'name'      => $champ['name'],
                    'title'     => $champ['title'],
                    'tags'      => $champ['tags'],
                    'image'     => $this->ddragon->championIconUrl($champ['id']),
                    'splash'    => $this->ddragon->splashArtUrl($champ['id']),
                    'centered'  => "{$ddragonBase}/cdn/img/champion/centered/{$champ['id']}_0.jpg",
                    'winRate'   => round($winRate, 1),
                    'pickRate'  => round($pickRate, 1),
                    'banRate'   => round($banRate, 1),
                    'wrChange'  => $wrChange,
                    'tier'      => $this->calculateTier($winRate, $pickRate),
                ];
            }

            usort($stats, fn($a, $b) => $b['winRate'] <=> $a['winRate']);

            // Top 5 win rate için son kostüm splash'ini bul
            $topWinRate = array_slice($stats, 0, 10);
            foreach (array_slice($topWinRate, 0, 5) as $i => $champ) {
                $detail = $this->ddragon->getChampionDetail($champ['id']);
                $lastRealSkin = $this->getLastRealSkin($detail['skins']);
                $topWinRate[$i]['latestSkinSplash'] = "{$ddragonBase}/cdn/img/champion/splash/{$champ['id']}_{$lastRealSkin}.jpg";
            }

            $risers = collect($stats)->where('wrChange', '>', 0)
                ->sortByDesc('wrChange')->values()->take(3)->all();
            $fallers = collect($stats)->where('wrChange', '<', 0)
                ->sortBy('wrChange')->values()->take(3)->all();

            return [
                'version'     => $version,
                'count'       => count($stats),
                'champions'   => $stats,
                'topWinRate'  => $topWinRate,
                'topPickRate' => array_slice(
                    collect($stats)->sortByDesc('pickRate')->values()->all(), 0, 10
                ),
                'topBanRate'  => array_slice(
                    collect($stats)->sortByDesc('banRate')->values()->all(), 0, 10
                ),
                'risers'      => array_values($risers),
                'fallers'     => array_values($fallers),
            ];
        });
    }

    /**
     * Chromas hariç son gerçek skin numarasını bul.
     * parentSkin alanı olan skinler chroma'dır.
     */
    private function getLastRealSkin(array $skins): int
    {
        $lastReal = 0;
        foreach ($skins as $skin) {
            if (!isset($skin['parentSkin']) || $skin['parentSkin'] === null) {
                $lastReal = $skin['num'];
            }
        }
        return $lastReal;
    }

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
