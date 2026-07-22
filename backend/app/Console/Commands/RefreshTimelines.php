<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\MatchTimeline;
use Illuminate\Console\Command;

/**
 * Cache'li timeline'ları siler; bir sonraki maç detayı açılışında Riot'tan
 * taze çekilir. ITEM_SOLD/ITEM_UNDO event'leri slim'e sonradan eklendiği için
 * eski kayıtlarda satış verisi yok — bu komut o kayıtları tazeletir.
 * Silme lazy re-fetch'e dayanır: toplu Riot isteği ATILMAZ, rate limit riski yok.
 */
class RefreshTimelines extends Command
{
    protected $signature = 'timelines:refresh
        {--days=30 : Yalnız son N günün maçlarının timeline\'ını sil (Riot eski timeline\'ı vermeyebilir)}
        {--match= : Tek bir matchId\'yi tazele}';

    protected $description = "Cache'li timeline'ları sil — detay açılınca Riot'tan satış verili taze kopya çekilir";

    public function handle(): int
    {
        $matchId = $this->option('match');
        if ($matchId) {
            $deleted = MatchTimeline::where('match_id', $matchId)->delete();
            $this->info("{$matchId}: " . ($deleted ? 'silindi, ilk açılışta tazelenecek.' : 'timeline kaydı yoktu.'));
            return self::SUCCESS;
        }

        $days = max(1, (int) $this->option('days'));
        $cutoffMs = now()->subDays($days)->getTimestampMs();

        $recentIds = MatchRecord::where('game_creation', '>=', $cutoffMs)->pluck('match_id');
        $deleted = MatchTimeline::whereIn('match_id', $recentIds)->delete();

        $this->info("Son {$days} günün {$recentIds->count()} maçından {$deleted} timeline silindi; detay açıldıkça tazelenecek.");
        return self::SUCCESS;
    }
}
