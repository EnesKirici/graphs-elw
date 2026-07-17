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

    public function isEnabled(): bool
    {
        return (bool) AdminSetting::getValue('worker_enabled', false);
    }

    /** Taranacak ligler (admin seçimi ∩ config'te tanımlı olanlar). */
    public function tiers(): array
    {
        $available = config('elwgraphs.worker.tiers_available', []);
        $selected = AdminSetting::getValue('worker_tiers', $available);

        return array_values(array_intersect((array) $selected, $available));
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
        $cooldown = Cache::get('riot:rate_limit_cooldown');
        if ($cooldown && time() < $cooldown) {
            return true;
        }

        $last = (int) Cache::get(self::USER_ACTIVITY_KEY, 0);
        $window = (int) config('elwgraphs.worker.user_yield_seconds', 8);

        return $last > 0 && (time() - $last) < $window;
    }

    /** Admin paneli durum kartları için özet. */
    public function status(): array
    {
        $todayStart = Carbon::today();

        return [
            'enabled'       => $this->isEnabled(),
            'tiers'         => $this->tiers(),
            'tiersAvailable' => config('elwgraphs.worker.tiers_available', []),
            'collectSince'  => AdminSetting::getValue('worker_collect_since', '2026-07-16'),
            'poolSize'      => CrawlPlayer::count(),
            'poolByTier'    => CrawlPlayer::select('tier', DB::raw('COUNT(*) c'))
                ->groupBy('tier')->pluck('c', 'tier'),
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
