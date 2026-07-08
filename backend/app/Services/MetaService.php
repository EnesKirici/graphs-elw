<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\CachedPlayer;
use App\Models\ChampionStat;
use App\Models\MatchRecord;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use App\Services\RiotApi\RiotApiService;
use App\Support\Statistics;
use Illuminate\Support\Facades\Cache;

class MetaService
{
    public function __construct(
        private DataDragonService $ddragon,
        private RiotApiService $riot,
        private ChampionStatsService $stats,
        private PatchService $patch,
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
        return Cache::remember('meta:dashboard_stats_v10', config('riot.cache_ttl.meta_stats'), function () {
            $champions = $this->ddragon->getChampions();
            $version = $this->ddragon->getCurrentVersion();
            $positionMap = $this->ddragon->getChampionPositions();
            $ddragonBase = config('riot.ddragon_url');

            // Görüntülenen istatistikler: tutulan patch penceresi (güncel + önceki) BİRLEŞİK
            // → küçük örneklemde listeler dolu kalır. wrChange için ayrıca tek-patch (güncel/önceki).
            $currentPatch = $this->stats->currentPatchBucket();
            $keptPatches = $this->patch->keptPatches();
            $realStats = $this->stats->getMetaStats($keptPatches);
            $currentStats = $this->stats->getMetaStats($currentPatch);
            $prevPatch = $this->previousPatch($currentPatch);
            $prevStats = $prevPatch ? $this->stats->getMetaStats($prevPatch) : [];

            // Yetersiz örneklemde davranış — admin panelden yönetilir.
            // 'label' = "veri yetersiz" (varsayılan, dürüst) | 'sim' = sahte simülasyonla doldur.
            $insufficientMode = AdminSetting::getValue('meta_insufficient_mode', 'label');
            $minGames = (int) config('elwgraphs.stats.min_games', 30);

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
                    // Gerçek patch değişimi: GÜNCEL vs ÖNCEKİ patch (ikisinde de yeterli veri varsa).
                    // Display birleşik pencereden gelse de wrChange tek-patch farkıdır (dürüst trend).
                    $wrChange = (isset($currentStats[$champ['id']], $prevStats[$champ['id']]))
                        ? round($currentStats[$champ['id']]['winRate'] - $prevStats[$champ['id']]['winRate'], 1)
                        : null;
                    // Shrinkage WR (adil + gerçekçi; sistematik düşürmez) + kompozit tier + düşük örneklem.
                    $wins = $r['wins'] ?? (int) round($winRate / 100 * $sampleSize);
                    $adj = Statistics::shrunkWinRate($wins, $sampleSize);
                    $adjWr = round($adj * 100, 1);
                    $lowSample = $sampleSize < $minGames;
                    $tier = $this->tierFromScore($this->compositeTierScore($adj, $pickRate, $banRate, $sampleSize));
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
                    $adjWr = null;
                    $lowSample = false;
                    $tier = $this->calculateTier($winRate, $pickRate);
                } else {
                    // "Veri yetersiz" — sayı gösterilmez (null)
                    $winRate = null;
                    $pickRate = null;
                    $banRate = null;
                    $wrChange = null;
                    $dataSource = 'insufficient';
                    $sampleSize = null;
                    $adjWr = null;
                    $lowSample = false;
                    $tier = null;
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
                    'adjWr'      => $adjWr,      // shrinkage WR (adil + gerçekçi; gösterim/sıralama temeli)
                    'tier'       => $tier,
                    'lowSample'  => $lowSample,  // sampleSize < min_games → "düşük örneklem"
                    'dataSource' => $dataSource,   // 'real' | 'sim' | 'insufficient'
                    'sampleSize' => $sampleSize,
                ];
            }

            // Sıralanabilir = winRate'i olan (real veya sim). 'insufficient' top listelere/risers'a girmez.
            $rankable = array_values(array_filter($stats, fn($s) => $s['winRate'] !== null));
            usort($rankable, fn($a, $b) => $b['winRate'] <=> $a['winRate']);
            // Şampiyon listesi: yetersizler sona düşsün.
            usort($stats, fn($a, $b) => ($b['winRate'] ?? -1) <=> ($a['winRate'] ?? -1));

            // "En Yüksek WR": ayarlı (shrinkage) WR'a göre sırala + düşük örneklem HARİÇ (dürüst).
            $wrList = array_values(array_filter($rankable, fn($s) => empty($s['lowSample'])));
            usort($wrList, fn($a, $b) => ($b['adjWr'] ?? $b['winRate']) <=> ($a['adjWr'] ?? $a['winRate']));
            $topWinRate = array_slice($wrList, 0, 10);
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
                // WR kategorisi: ayarlı (shrinkage) WR göster → sıralamayla tutarlı + gerçekçi.
                ['list' => $topWinRate, 'category' => 'En Yüksek Win Rate', 'valueKey' => 'adjWr', 'suffix' => '%'],
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

            // Yeni şampiyon Locke — slider'ın BAŞINA sabitle (tanıtım): "Yeni Şampiyon" rozetiyle
            // ilk açılır, sonra döngüyle diğerlerine geçer. Yeni şampiyon az oynanır → dashboard
            // MIN_SAMPLE eşiğine takılıp WR/pick "0,0%" (null) görünürdü. Öne çıkan kartta bu yanıltıcı;
            // WR/pick/ban'ı doğrudan sayaçtan hesapla + "düşük örneklem" işaretiyle dürüstçe göster.
            $lockeStat = collect($stats)->firstWhere('id', 'Locke');
            if ($lockeStat) {
                $lockeRow = ChampionStat::where('patch', $currentPatch)
                    ->where('champion_id', 'Locke')->where('position', 'ALL')->first();
                $patchTotal = optional(StatPatch::find($currentPatch))->total_games ?? 0;
                $detail = $this->ddragon->getChampionDetail('Locke');
                $lastRealSkin = $this->getLastRealSkin($detail['skins'] ?? []);

                $entry = $lockeStat;
                if ($lockeRow && $lockeRow->games > 0) {
                    $g = (int) $lockeRow->games;
                    $wns = (int) $lockeRow->wins;
                    $adj = Statistics::shrunkWinRate($wns, $g);
                    $entry['winRate']    = round($wns / $g * 100, 1);
                    $entry['adjWr']      = round($adj * 100, 1);
                    $entry['pickRate']   = $patchTotal > 0 ? round($g / $patchTotal * 100, 1) : 0.0;
                    $entry['banRate']    = $patchTotal > 0 ? round($lockeRow->bans / $patchTotal * 100, 1) : ($lockeStat['banRate'] ?? 0);
                    $entry['sampleSize'] = $g;
                    $entry['lowSample']  = $g < $minGames;
                    $entry['dataSource'] = 'real';
                    $entry['tier']       = $this->tierFromScore($this->compositeTierScore($adj, $entry['pickRate'], $entry['banRate'], $g));
                }
                $entry['latestSkinSplash'] = "{$ddragonBase}/cdn/img/champion/splash/Locke_{$lastRealSkin}.jpg";
                $entry['latestSkinName'] = $lockeStat['name'];
                $entry['sliderCategory'] = 'Yeni Şampiyon';
                $entry['sliderRank'] = 1;
                $entry['sliderValue'] = ($entry['adjWr'] ?? $entry['winRate'] ?? 0).'%';
                $entry['skins'] = $this->ddragon->formatSkins($detail);
                array_unshift($sliderPool, $entry);
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
     * Rol-bazlı meta tier list: her şampiyonun OYNANDIĞI her koridor için
     * WR/pick/ban/shrinkage + kompozit tier + koridor dağılımı (laneShare).
     * Kaynak: champion_stats per-position. Eşik daha düşük (10) → tier-list daha dolu;
     * 30 altı "düşük örneklem" işaretlenir. Production key + crawler ile gerçek meta'ya oturur.
     * GET /api/v1/meta/tier-list
     */
    public function getTierList(): array
    {
        return Cache::remember('meta:tier_list_v3', config('riot.cache_ttl.meta_stats'), function () {
            $version = $this->ddragon->getCurrentVersion();
            $patch = $this->stats->currentPatchBucket();
            // Tutulan patch penceresi (güncel + önceki) birleşik → tier-list dolu kalır.
            $data = $this->stats->getPositionStats($this->patch->keptPatches());
            $total = $data['total'];
            $byChamp = $data['champions'];

            $minGames = 10;       // tier-list rol eşiği (dashboard MIN_SAMPLE=20'den ayrı, daha dolu)
            $lowSampleUnder = 30; // bunun altı "düşük örneklem" rozeti
            $positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

            $out = [];
            foreach ($this->ddragon->getChampions() as $champ) {
                $id = $champ['id'];
                $st = $byChamp[$id] ?? null;
                if (! $st) {
                    continue;
                }
                $allGames = $st['ALL']['games'] ?? 0;
                $bans = $st['ALL']['bans'] ?? 0;
                if ($allGames < 1) {
                    continue;
                }

                $ban = $total > 0 ? round($bans / $total * 100, 1) : 0.0; // ban rol-bağımsız (şampiyon banlanır)

                $roles = [];

                // "Tümü" sekmesi (ALL) — tüm rollerin toplamı, genel sıralama.
                if ($allGames >= $minGames) {
                    $allW = $st['ALL']['wins'] ?? 0;
                    $adjAll = Statistics::shrunkWinRate($allW, $allGames);
                    $pickAll = $total > 0 ? round($allGames / $total * 100, 1) : 0.0;
                    $roles['ALL'] = [
                        'wr'        => round($allW / $allGames * 100, 1),
                        'adjWr'     => round($adjAll * 100, 1),
                        'pick'      => $pickAll,
                        'ban'       => $ban,
                        'games'     => $allGames,
                        'laneShare' => 100,
                        'tier'      => $this->tierFromScore($this->compositeTierScore($adjAll, $pickAll, $ban, $allGames)),
                        'lowSample' => $allGames < $lowSampleUnder,
                    ];
                }

                foreach ($positions as $pos) {
                    $ps = $st[$pos] ?? null;
                    if (! $ps || $ps['games'] < $minGames) {
                        continue;
                    }
                    $g = $ps['games'];
                    $w = $ps['wins'];
                    $adj = Statistics::shrunkWinRate($w, $g);
                    $pick = $total > 0 ? round($g / $total * 100, 1) : 0.0;

                    $roles[$pos] = [
                        'wr'        => round($w / $g * 100, 1),
                        'adjWr'     => round($adj * 100, 1),
                        'pick'      => $pick,
                        'ban'       => $ban,
                        'games'     => $g,
                        'laneShare' => $allGames > 0 ? (int) round($g / $allGames * 100) : 0,
                        'tier'      => $this->tierFromScore($this->compositeTierScore($adj, $pick, $ban, $g)),
                        'lowSample' => $g < $lowSampleUnder,
                    ];
                }
                if (empty($roles)) {
                    continue;
                }

                $out[] = [
                    'id'    => $id,
                    'name'  => $champ['name'],
                    'tags'  => $champ['tags'],
                    'image' => $this->ddragon->championIconUrl($id),
                    'roles' => $roles,
                ];
            }

            return [
                'version'    => $version,
                'patch'      => $patch,
                'totalGames' => $total,
                'minGames'   => $minGames,
                'champions'  => $out,
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

    /**
     * Kompozit tier skoru (0–1): Wilson WR (ana) + pick + ban + örneklem güveni.
     * Bileşenler 0–1 normalize edilir, config ağırlıklarıyla toplanır.
     */
    private function compositeTierScore(float $wilson, float $pickRate, float $banRate, int $games): float
    {
        $n = config('elwgraphs.tier.normalize');
        $w = config('elwgraphs.tier.weights');
        $sampleAt = (float) config('elwgraphs.tier.sample_full_confidence_at', 200);

        $normWr   = Statistics::clamp01(($wilson - $n['wr_min']) / max(0.0001, $n['wr_max'] - $n['wr_min']));
        $normPick = Statistics::clamp01($pickRate / max(0.0001, $n['pick_max']));
        $normBan  = Statistics::clamp01($banRate / max(0.0001, $n['ban_max']));
        $conf     = Statistics::clamp01($games / max(1, $sampleAt));

        return $w['wilson_wr'] * $normWr
            + $w['pick_rate'] * $normPick
            + $w['ban_rate'] * $normBan
            + $w['sample'] * $conf;
    }

    /** Kompozit skoru (0–1) config eşiklerine göre tier'a (S+/S/A/B/C/D) çevir. */
    private function tierFromScore(float $score): string
    {
        foreach (config('elwgraphs.tier.thresholds') as $tier => $min) {
            if ($score >= $min) {
                return $tier;
            }
        }

        return 'D';
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
