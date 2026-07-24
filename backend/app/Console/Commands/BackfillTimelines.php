<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use App\Services\PatchService;
use App\Services\RiotApi\RiotApiService;
use App\Services\WorkerControlService;
use Illuminate\Console\Command;

/**
 * Eski maçların timeline'larını Riot'tan çekip timeline sayaçlarını
 * (skill_order / starter / item_slot1-5) doldurur; timeline SAKLANMAZ (disk maliyeti yok).
 *
 * Yalnız gösterilen patch penceresindeki maçlar çekilir (eskisi boşa istek olur).
 * CollectMatches ile aynı görgü kuralları: worker kapalıysa/kullanıcı varken çalışmaz,
 * 429'da turu bırakır. Bayrak: processed_matches.timeline_done.
 */
class BackfillTimelines extends Command
{
    protected $signature = 'timelines:backfill
        {--limit=50 : Tur başına en fazla timeline isteği}
        {--force : worker_enabled kapalıyken de çalıştır}';

    protected $description = 'Eski maçların timeline istatistiklerini (bütçeli) geriye dönük doldurur';

    public function handle(
        RiotApiService $api,
        BuildAggregationService $agg,
        WorkerControlService $control,
        PatchService $patch,
    ): int {
        if (! $control->isEnabled() && ! $this->option('force')) {
            $this->info('Worker kapalı (worker_enabled). --force ile elle çalıştırabilirsin.');
            return self::SUCCESS;
        }
        if ($control->shouldYield()) {
            $this->info('Kullanıcı trafiği / rate limit aktif — bu tur atlandı.');
            return self::SUCCESS;
        }

        $batch = ProcessedMatch::where('timeline_done', false)
            ->whereIn('patch', $patch->keptPatches())
            ->orderByDesc('processed_at')
            ->limit((int) $this->option('limit'))
            ->pluck('match_id');

        if ($batch->isEmpty()) {
            $this->info('Bekleyen timeline yok — güncel.');
            return self::SUCCESS;
        }

        $done = $skipped = 0;
        foreach ($batch as $matchId) {
            if ($control->shouldYield()) {
                $this->info('Kullanıcı trafiği algılandı — tur erken bitirildi.');
                break;
            }

            $data = MatchRecord::find($matchId)?->data;
            if (! $data) {
                // Ham maç verisi yok → timeline işlenemez, bayrakla ve geç.
                ProcessedMatch::where('match_id', $matchId)->update(['timeline_done' => true]);
                $skipped++;
                continue;
            }

            try {
                $timeline = $api->regionRequest("/lol/match/v5/matches/{$matchId}/timeline");
            } catch (\Throwable $e) {
                if ((int) $e->getCode() === 429) {
                    $this->warn('Rate limit — tur bitirildi.');
                    break;
                }
                if ((int) $e->getCode() === 404) {
                    // Riot artık vermiyor (çok eski) → bayrakla, tekrar deneme.
                    ProcessedMatch::where('match_id', $matchId)->update(['timeline_done' => true]);
                    $skipped++;
                }
                continue;
            }

            $agg->processTimeline($data, $timeline);
            ProcessedMatch::where('match_id', $matchId)->update(['timeline_done' => true]);
            $done++;
        }

        $this->info("Timeline işlendi: {$done} · atlandı: {$skipped} · kalan: "
            . ProcessedMatch::where('timeline_done', false)->whereIn('patch', $patch->keptPatches())->count());

        return self::SUCCESS;
    }
}
