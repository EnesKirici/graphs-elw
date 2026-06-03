<?php

namespace App\Services;

use App\Models\CachedPlayer;
use App\Models\MatchRecord;
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
        return Cache::remember('meta:dashboard_stats_v6', config('riot.cache_ttl.meta_stats'), function () {
            $champions = $this->ddragon->getChampions();
            $version = $this->ddragon->getCurrentVersion();
            $rotation = $this->getFreeRotation();
            $positionMap = $this->ddragon->getChampionPositions();
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
                    'positions' => $positionMap[$champ['id']] ?? [],
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

            $topWinRate = array_slice($stats, 0, 10);
            $topPickRate = array_slice(
                collect($stats)->sortByDesc('pickRate')->values()->all(), 0, 10
            );
            $topBanRate = array_slice(
                collect($stats)->sortByDesc('banRate')->values()->all(), 0, 10
            );

            // Slider havuzu: her kategoriden top 7'ye skin datası ekle
            // Frontend bu havuzdan her refresh'te rastgele seçecek
            $sliderPool = [];
            $seen = [];

            $categories = [
                ['list' => $topWinRate, 'category' => 'En Yüksek Win Rate', 'valueKey' => 'winRate', 'suffix' => '%'],
                ['list' => $topPickRate, 'category' => 'En Popüler', 'valueKey' => 'pickRate', 'suffix' => '%'],
                ['list' => $topBanRate, 'category' => 'En Çok Banlanan', 'valueKey' => 'banRate', 'suffix' => '%'],
            ];

            foreach ($categories as $cat) {
                $rank = 0;
                $catCount = 0;
                foreach ($cat['list'] as $champ) {
                    $rank++;
                    if (in_array($champ['id'], $seen)) continue;
                    if ($catCount >= 5) break;

                    $detail = $this->ddragon->getChampionDetail($champ['id']);
                    $lastRealSkin = $this->getLastRealSkin($detail['skins']);
                    $skinName = collect($detail['skins'])->firstWhere('num', $lastRealSkin)['name'] ?? $champ['name'];
                    if ($skinName === 'default') $skinName = $champ['name'];

                    $entry = $champ;
                    $entry['latestSkinSplash'] = "{$ddragonBase}/cdn/img/champion/splash/{$champ['id']}_{$lastRealSkin}.jpg";
                    $entry['latestSkinName'] = $skinName;
                    $entry['sliderCategory'] = $cat['category'];
                    $entry['sliderRank'] = $rank;
                    $entry['sliderValue'] = $champ[$cat['valueKey']] . $cat['suffix'];
                    // Tüm kostümler (hero'da skin değiştirme için) — ekstra istek olmasın.
                    $entry['skins'] = $this->ddragon->formatSkins($detail);

                    $sliderPool[] = $entry;
                    $seen[] = $champ['id'];
                    $catCount++;
                }
            }

            $risers = collect($stats)->where('wrChange', '>', 0)
                ->sortByDesc('wrChange')->values()->take(3)->all();
            $fallers = collect($stats)->where('wrChange', '<', 0)
                ->sortBy('wrChange')->values()->take(3)->all();

            return [
                'version'     => $version,
                'count'       => count($stats),
                'champions'   => $stats,
                'sliderPool'  => $sliderPool,
                'topWinRate'  => $topWinRate,
                'topPickRate' => $topPickRate,
                'topBanRate'  => $topBanRate,
                'risers'      => array_values($risers),
                'fallers'     => array_values($fallers),
            ];
        });
    }

    /**
     * Site geneli canlı sayaçlar (dashboard meta şeridi).
     * Ucuz DB count'ları — büyük DDragon cache'inden ayrı, kısa süre cache'lenir
     * ki sayılar güncel kalsın ama her istekte COUNT atılmasın.
     * GET /api/v1/meta/stats
     */
    public function getSiteStats(): array
    {
        return Cache::remember('meta:site_stats', 60, function () {
            return [
                'matchesAnalyzed' => MatchRecord::count(),
                'trackedPlayers'  => CachedPlayer::count(),
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
