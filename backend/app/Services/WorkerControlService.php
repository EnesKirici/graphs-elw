<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\CrawlPlayer;
use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\RiotApi\RiotApiService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Meta worker'ın (ladder:crawl + matches:collect) TEK kontrol noktası.
 *
 * Aç/kapa, taranacak ligler ve maç başlangıç tarihi admin_settings'te durur
 * (panelden değişir, deploy gerektirmez). Sabit bütçe sınırları config
 * elwgraphs.worker'da. Komutlar ve admin endpoint'i yalnız bu servisi kullanır.
 */
class WorkerControlService
{
    /** Kullanıcı kaynaklı son Riot isteğinin damgalandığı cache anahtarı (RiotApiService yazar). */
    public const USER_ACTIVITY_KEY = 'riot:last_user_request';

    /** Havuz sayımlarının (boyut + lig dağılımı) cache anahtarı — bkz. poolStats(). */
    private const POOL_STATS_KEY = 'worker:pool_stats';

    public function isEnabled(): bool
    {
        return (bool) AdminSetting::getValue('worker_enabled', false);
    }

    /**
     * Tarama modu — hangi ligler ne öncelikle taranacak (CollectMatches uygular):
     *  - 'apex'  : SADECE apex (Challenger/GM/Master) → yeni patch en hızlı dolar, alt elo beklemede
     *  - 'mixed' : apex AĞIRLIKLI ama Zümrüt/Elmas da az az taranır (tur bütçesi ~%70 / %30)
     *  - 'fair'  : TÜM ligler adil (last_scanned_at) sırayla → en geniş meta, 16.15 daha yavaş
     * Default 'apex' (yeni patch tazeliği için); panelden değiştirilir.
     */
    public function scanMode(): string
    {
        $mode = (string) AdminSetting::getValue('worker_scan_mode', 'apex');

        return in_array($mode, ['apex', 'fair', 'mixed'], true) ? $mode : 'apex';
    }

    /** Taranacak ligler (admin seçimi ∩ config'te tanımlı olanlar). */
    public function tiers(): array
    {
        $available = config('elwgraphs.worker.tiers_available', []);
        $selected = AdminSetting::getValue('worker_tiers', $available);

        return array_values(array_intersect((array) $selected, $available));
    }

    // --- Performans ayarları (panelden: admin_settings → yoksa config yedeği) ---

    /** Tur başına kuyruğa atılacak maks yeni maç (hız düğmesi). */
    public function matchBudget(): int
    {
        return max(1, (int) AdminSetting::getValue('worker_match_budget', config('elwgraphs.worker.match_budget', 40)));
    }

    /** Tur başına taranacak oyuncu sayısı. */
    public function playersPerRun(): int
    {
        return max(1, (int) AdminSetting::getValue('worker_players', config('elwgraphs.worker.players', 15)));
    }

    /** Kullanıcı Riot isteğinden sonra worker'ın yol verdiği saniye (0 = worker öncelikli). */
    public function userYieldSeconds(): int
    {
        return max(0, (int) AdminSetting::getValue('worker_user_yield', config('elwgraphs.worker.user_yield_seconds', 8)));
    }

    /** Bu epoch'tan (saniye) eski maçlar toplanmaz. Default: 16.14 patch dönemi başı. */
    public function collectSinceTimestamp(): int
    {
        $date = AdminSetting::getValue('worker_collect_since', '2026-07-16');

        try {
            return Carbon::parse($date)->startOfDay()->getTimestamp();
        } catch (\Throwable) {
            return Carbon::parse('2026-07-16')->startOfDay()->getTimestamp();
        }
    }

    /**
     * Kullanıcı önceliği: son N saniyede site kullanıcısı Riot'a istek attıysa
     * (veya 429 cooldown aktifse) worker bu turu bırakmalı.
     */
    public function shouldYield(): bool
    {
        // Anahtar GEÇERSİZ (401/403 → key_invalid): worker hiç istek atmasın, boşa 401
        // yağdırıp failed_jobs'u şişirmesin. Yeni key panelden girilince RiotKeyStore::put
        // bu flag'i temizler → worker kendiliğinden devam eder.
        if (Cache::get('riot:key_invalid')) {
            return true;
        }

        $cooldown = Cache::get('riot:rate_limit_cooldown');
        if ($cooldown && time() < $cooldown) {
            return true;
        }

        $last = (int) Cache::get(self::USER_ACTIVITY_KEY, 0);
        $window = $this->userYieldSeconds(); // panelden; 0 = worker öncelikli, kullanıcıya yol vermez

        return $window > 0 && $last > 0 && (time() - $last) < $window;
    }

    /**
     * Havuz sayımları: toplam boyut + lig dağılımı (panel kartları).
     *
     * Eskiden iki ayrı sorguydu (COUNT(*) + GROUP BY tier) ve crawl_players 180K satıra
     * ulaştığından ikisi birlikte panel açılışının ~3 saniyesini yiyordu. Tek gruplama
     * yeter — toplam, grupların toplamıdır. Havuz yalnız ladder:crawl çalışınca değişir
     * (gecelik cron veya elle) → 60 sn cache güvenli; panel 15 sn'de bir yenilendiği için
     * asıl kazanç burada. Elle tarama sonrası WorkerController::crawl cache'i düşürür.
     */
    private function poolStats(): array
    {
        return Cache::remember(self::POOL_STATS_KEY, 60, function () {
            $byTier = CrawlPlayer::select('tier', DB::raw('COUNT(*) c'))
                ->groupBy('tier')
                ->pluck('c', 'tier')
                ->all();

            return ['byTier' => $byTier, 'size' => array_sum($byTier)];
        });
    }

    /** Havuz sayımları cache'ini düşür — elle tarama sonrası panel taze göstersin. */
    public function forgetPoolStats(): void
    {
        Cache::forget(self::POOL_STATS_KEY);
    }

    /** Admin paneli durum kartları için özet. */
    public function status(): array
    {
        $todayStart = Carbon::today();
        $pool = $this->poolStats();

        return [
            'enabled'       => $this->isEnabled(),
            'scanMode'      => $this->scanMode(),
            'matchBudget'   => $this->matchBudget(),
            'playersPerRun' => $this->playersPerRun(),
            'userYield'     => $this->userYieldSeconds(),
            // Meta gösterim penceresi (kaç patch birleşik). PatchService::keptPatches ile aynı kaynak.
            'metaKeepPatches' => (int) AdminSetting::getValue('meta_keep_patches', config('elwgraphs.meta.keep_patches', 2)),
            // Slider "Yeni Şampiyon" seçimi (boş = kapalı, slider tamamen dinamik).
            'sliderNewChampion' => (string) AdminSetting::getValue('slider_new_champion', config('elwgraphs.meta.new_champion', 'Locke')),
            'tiers'         => $this->tiers(),
            'tiersAvailable' => config('elwgraphs.worker.tiers_available', []),
            'collectSince'  => AdminSetting::getValue('worker_collect_since', '2026-07-16'),
            'poolSize'      => $pool['size'],
            'poolByTier'    => $pool['byTier'],
            'queueDepth'    => (int) DB::table('jobs')->count(),
            'processedTotal' => ProcessedMatch::count(),
            'processedToday' => ProcessedMatch::where('processed_at', '>=', $todayStart)->count(),
            'matchesTotal'  => MatchRecord::count(),
            'lastCrawlAt'   => Cache::get('worker:last_crawl_at'),
            'lastCollectAt' => Cache::get('worker:last_collect_at'),
            'rate'          => RiotApiService::getRateLimitStatus(),
        ];
    }
}
