<?php

namespace App\Console\Commands;

use App\Jobs\ProcessMatchJob;
use App\Models\CrawlPlayer;
use App\Models\ProcessedMatch;
use App\Services\RiotApi\MatchDataService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * crawl_players havuzundan oyuncu alır, ranked maç ID'lerini çeker ve
 * işlenmemiş olanları ProcessMatchJob kuyruğuna atar.
 *
 * En eski taranmış (last_scanned_at) oyuncudan başlar → adil dağılım.
 * ⚠️ Production key gerektirir. queue:work çalışıyor olmalı (job'lar işlensin).
 */
class CollectMatches extends Command
{
    private const RANKED_QUEUES = [420, 440];

    protected $signature = 'matches:collect {--limit=50}';

    protected $description = 'Havuzdaki oyuncuların yeni ranked maçlarını ProcessMatchJob kuyruğuna atar';

    public function handle(MatchDataService $matchData): int
    {
        $region = config('riot.platform', 'tr1');
        $limit = (int) $this->option('limit');

        $players = CrawlPlayer::orderByRaw('last_scanned_at IS NULL DESC, last_scanned_at ASC')
            ->limit($limit)
            ->get();

        if ($players->isEmpty()) {
            $this->warn('Havuz boş. Önce `ladder:crawl` çalıştır.');
            return self::SUCCESS;
        }

        $dispatched = 0;

        foreach ($players as $cp) {
            foreach (self::RANKED_QUEUES as $queueId) {
                try {
                    $ids = $matchData->getSeasonMatchIds($cp->puuid, $queueId);
                } catch (\Throwable $e) {
                    continue;
                }
                foreach ($ids as $matchId) {
                    if (ProcessedMatch::where('match_id', $matchId)->exists()) {
                        continue;
                    }
                    ProcessMatchJob::dispatch($matchId, $region);
                    $dispatched++;
                }
            }
            $cp->update(['last_scanned_at' => Carbon::now()]);
        }

        $this->info("Taranan oyuncu: {$players->count()} · Kuyruğa atılan maç: {$dispatched}");

        // NOT (iskelet): production'da oyuncu-bazlı zaman imleci tutulup yalnızca yeni
        // maçlar çekilmeli (şu an tüm sezon ID'leri çekilip ProcessedMatch ile eleniyor).

        return self::SUCCESS;
    }
}
