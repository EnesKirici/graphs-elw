<?php

namespace App\Jobs;

use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use App\Services\RiotApi\MatchDataService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

/**
 * Tek maçı işleyip aggregate sayaçlara ekler (champion_stats/builds/top_players).
 * İşlenen maç processed_matches'e yazılır → çift sayım yok.
 */
class ProcessMatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $matchId,
        public string $region = 'tr1',
    ) {}

    public function handle(MatchDataService $matchData, BuildAggregationService $agg): void
    {
        // Zaten işlendiyse atla
        if (ProcessedMatch::where('match_id', $this->matchId)->exists()) {
            return;
        }

        try {
            $detail = $matchData->getMatchDetail($this->matchId);
        } catch (\Throwable $e) {
            return; // geçici hata → tekrar denenebilir (job retry)
        }

        $agg->processMatch($detail, $this->region);

        // Ranked olmayan/remake maçlar da işlenmiş sayılır (tekrar çekmemek için)
        ProcessedMatch::create([
            'match_id'     => $this->matchId,
            'patch'        => $this->patchOf($detail),
            'processed_at' => Carbon::now(),
        ]);
    }

    private function patchOf(array $detail): ?string
    {
        $v = $detail['info']['gameVersion'] ?? '';
        $parts = explode('.', $v);
        return count($parts) >= 2 ? "{$parts[0]}.{$parts[1]}" : null;
    }
}
