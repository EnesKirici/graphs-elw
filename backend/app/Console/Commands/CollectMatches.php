<?php

namespace App\Console\Commands;

use App\Jobs\ProcessMatchJob;
use App\Models\CrawlPlayer;
use App\Models\ProcessedMatch;
use App\Services\RiotApi\RiotApiService;
use App\Services\WorkerControlService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * crawl_players havuzundan oyuncu alır, SEÇİLİ tarihten sonraki son ranked maç
 * ID'lerini çeker ve işlenmemiş olanları ProcessMatchJob kuyruğuna atar.
 *
 * Personal key bütçesine göre KISITLI çalışır:
 *  - Tur başına en fazla `match_budget` yeni maç kuyruğa atılır (≈ detay isteği bütçesi).
 *  - Oyuncu başına en yeni `recent_per_player` maç ID'si istenir (tüm sezon DEĞİL).
 *  - Kullanıcı Riot'a istek attıysa / 429 cooldown varsa tur bırakılır (user-yield).
 * En eski taranan oyuncudan başlar → havuzda adil dağılım.
 */
class CollectMatches extends Command
{
    private const RANKED_QUEUES = [420, 440];

    protected $signature = 'matches:collect {--players=15 : Bu turda taranacak oyuncu sayısı} {--force : worker_enabled kapalıyken de çalıştır}';

    protected $description = 'Havuzdaki oyuncuların yeni ranked maçlarını (bütçeli) ProcessMatchJob kuyruğuna atar';

    public function handle(RiotApiService $api, WorkerControlService $control): int
    {
        if (! $control->isEnabled() && ! $this->option('force')) {
            $this->info('Worker kapalı (worker_enabled). --force ile elle çalıştırabilirsin.');
            return self::SUCCESS;
        }
        if ($control->shouldYield()) {
            $this->info('Kullanıcı trafiği / rate limit aktif — bu tur atlandı.');
            return self::SUCCESS;
        }

        $tiers = $control->tiers();
        if (empty($tiers)) {
            $this->warn('Seçili lig yok (worker_tiers boş).');
            return self::SUCCESS;
        }

        $players = CrawlPlayer::whereIn('tier', $tiers)
            ->orderByRaw('last_scanned_at IS NULL DESC, last_scanned_at ASC')
            ->limit((int) $this->option('players'))
            ->get();

        if ($players->isEmpty()) {
            $this->warn('Havuz boş. Önce `ladder:crawl` çalıştır.');
            return self::SUCCESS;
        }

        $budget = max(1, (int) config('elwgraphs.worker.match_budget', 40));
        $perPlayer = max(1, (int) config('elwgraphs.worker.recent_per_player', 10));
        $since = $control->collectSinceTimestamp();

        $dispatched = 0;
        $scanned = 0;

        foreach ($players as $cp) {
            // Araya kullanıcı girdiyse kalan oyuncuları sonraki tura bırak.
            if ($control->shouldYield()) {
                $this->info('Kullanıcı trafiği algılandı — tur erken bitirildi.');
                break;
            }

            $ids = [];
            foreach (self::RANKED_QUEUES as $queueId) {
                try {
                    $ids = array_merge($ids, (array) $api->regionRequest(
                        "/lol/match/v5/matches/by-puuid/{$cp->puuid}/ids",
                        ['startTime' => $since, 'queue' => $queueId, 'count' => $perPlayer],
                    ));
                } catch (\Throwable $e) {
                    if ((int) $e->getCode() === 429) {
                        $this->warn('Rate limit — tur bitirildi.');
                        break 2;
                    }
                    continue;
                }
            }

            $cp->update(['last_scanned_at' => Carbon::now()]);
            $scanned++;

            if (empty($ids)) {
                continue;
            }

            $known = ProcessedMatch::whereIn('match_id', $ids)->pluck('match_id')->all();
            foreach (array_diff($ids, $known) as $matchId) {
                ProcessMatchJob::dispatch($matchId, $cp->region ?: 'tr1', $cp->tier);
                $dispatched++;
                if ($dispatched >= $budget) {
                    $this->info("Bütçe doldu ({$budget}).");
                    break 2;
                }
            }
        }

        Cache::put('worker:last_collect_at', now()->toDateTimeString(), 60 * 60 * 24 * 7);
        $this->info("Taranan oyuncu: {$scanned} · Kuyruğa atılan maç: {$dispatched}");

        return self::SUCCESS;
    }
}
