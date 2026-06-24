<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\CachedPlayer;
use App\Models\MatchRecord;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use App\Services\RiotApi\RiotApiService;
use Illuminate\Support\Facades\Cache;

class MetaService
{
    public function __construct(
        private DataDragonService $ddragon,
        private RiotApiService $riot,
        private ChampionStatsService $stats,
    ) {}

    public function getFreeRotation(): array
    {
        try {
            return Cache::remember('meta:free_rotation', 3600, function () {
                return $this->riot->platformRequest('/lol/platform/v3/champion-rotations');
            });
        } catch (\Throwable $e) {
            // Riot tökezlerse (503/expire/rate-limit) rotasyon kritik değil — boş döner.
            // Hata CACHE'LENMEZ (Cache::remember exception'da yazmaz) → sonraki istek tekrar dener.
            return ['freeChampionIds' => [], 'freeChampionIdsForNewPlayers' => [], 'maxNewPlayerLevel' => 0];
        }
    }

    public function getDashboardStats(): array
    {
        return Cache::remember('meta:dashboard_stats_v7', config('riot.cache_ttl.meta_stats'), function () {
            $champions = $this->ddragon->getChampions();
            $version = $this->ddragon->getCurrentVersion();
            $positionMap = $this->ddragon->getChampionPositions();
            $ddragonBase = config('riot.ddragon_url');

            // Gerçek istatistikler (yeterli örneklemli) + önceki patch (gerçek wrChange için).
            $currentPatch = $this->stats->currentPatchBucket();
            $realStats = $this->stats->getMetaStats($currentPatch);
            $prevPatch = $this->previousPatch($currentPatch);
            $prevStats = $prevPatch ? $this->stats->getMetaStats($prevPatch) : [];

            // Yetersiz örneklemde davranış — admin panelden yönetilir.
            // 'label' = "veri yetersiz" (varsayılan, dürüst) | 'sim' = sahte simülasyonla doldur.
            $insufficientMode = AdminSetting::getValue('meta_insufficient_mode', 'label');

            $stats = [];
            foreach ($champions as $champ) {
                $key = (int) $champ['key'];

                if (isset($realStats[$champ['id']])) {
                    // GERÇEK veri
                    $r = $realStats[$champ['id']];
                    $winRate = $r['winRate'];
                    $pickRate = $r['pickRate'];
                    $banRate = $r['banRate'];
                    $dataSource = 'real';
                    $sampleSize = $r['sampleSize'];
                    // Gerçek patch değişimi: önceki patch'te de yeterli veri varsa fark, yoksa null.
                    $wrChange = isset($prevStats[$champ['id']])
                        ? round($winRate - $prevStats[$champ['id']]['winRate'], 1)
                        : null;
                } elseif ($insufficientMode === 'sim') {
                    // Sahte simülasyon (admin tercih ederse)
                    $h1 = abs(crc32($champ['id'] . 'wr'));
                    $h2 = abs(crc32($champ['id'] . 'pr'));
                    $h3 = abs(crc32($champ['id'] . 'br'));
                    $h4 = abs(crc32($champ['id'] . 'ch'));
                    $winRate = 44 + ($h1 % 1400) / 100;
                    $pickRate = 1 + ($h2 % 2800) / 100;
                    $banRate = 0.5 + ($h3 % 3500) / 100;
                    $wrChange = round(($h4 % 60 - 30) / 10, 1);
                    $dataSource = 'sim';
                    $sampleSize = null;
                } else {
                    // "Veri yetersiz" — sayı gösterilmez (null)
                    $winRate = null;
                    $pickRate = null;
                    $banRate = null;
                    $wrChange = null;
                    $dataSource = 'insufficient';
                    $sampleSize = null;
                }

                $stats[] = [
                    'id'         => $champ['id'],
                    'key'        => $key,
                    'name'       => $champ['name'],
                    'title'      => $champ['title'],
                    'tags'       => $champ['tags'],
                    'positions'  => $positionMap[$champ['id']] ?? [],
                    'image'      => $this->ddragon->championIconUrl($champ['id']),
                    'splash'     => $this->ddragon->splashArtUrl($champ['id']),
                    'centered'   => "{$ddragonBase}/cdn/img/champion/centered/{$champ['id']}_0.jpg",
                    'winRate'    => $winRate !== null ? round($winRate, 1) : null,
                    'pickRate'   => $pickRate !== null ? round($pickRate, 1) : null,
                    'banRate'    => $banRate !== null ? round($banRate, 1) : null,
                    'wrChange'   => $wrChange,
                    'tier'       => $winRate !== null ? $this->calculateTier($winRate, $pickRate) : null,
                    'dataSource' => $dataSource,   // 'real' | 'sim' | 'insufficient'
                    'sampleSize' => $sampleSize,
                ];
            }

            // Sıralanabilir = winRate'i olan (real veya sim). 'insufficient' top listelere/risers'a girmez.
            $rankable = array_values(array_filter($stats, fn($s) => $s['winRate'] !== null));
            usort($rankable, fn($a, $b) => $b['winRate'] <=> $a['winRate']);
            // Şampiyon listesi: yetersizler sona düşsün.
            usort($stats, fn($a, $b) => ($b['winRate'] ?? -1) <=> ($a['winRate'] ?? -1));

            $topWinRate = array_slice($rankable, 0, 10);
            $topPickRate = array_slice(
                collect($rankable)->sortByDesc('pickRate')->values()->all(), 0, 10
            );
            $topBanRate = array_slice(
                collect($rankable)->sortByDesc('banRate')->values()->all(), 0, 10
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

            $risers = collect($rankable)->where('wrChange', '>', 0)
                ->sortByDesc('wrChange')->values()->take(3)->all();
            $fallers = collect($rankable)->where('wrChange', '<', 0)
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

    /** Bir önceki patch bucket'ı ("16.12" → "16.11"); yoksa null. Numerik sıralama. */
    private function previousPatch(string $current): ?string
    {
        $patches = StatPatch::pluck('patch')->all();
        usort($patches, function ($a, $b) {
            $pa = array_map('intval', explode('.', $a));
            $pb = array_map('intval', explode('.', $b));
            return ($pb[0] <=> $pa[0]) ?: (($pb[1] ?? 0) <=> ($pa[1] ?? 0));
        });
        $i = array_search($current, $patches, true);

        return ($i !== false && isset($patches[$i + 1])) ? $patches[$i + 1] : null;
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
