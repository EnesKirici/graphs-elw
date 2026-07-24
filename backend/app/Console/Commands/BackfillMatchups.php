<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Eski işlenmiş maçlar için champion_matchups sayaçlarını doldurur.
 * Riot API'ye GİTMEZ — matches tablosundaki ham veriden okur.
 * builds:backfill-runes ile aynı desen: bayrak (matchup_done) + toplu upsert.
 */
class BackfillMatchups extends Command
{
    protected $signature = 'builds:backfill-matchups {--chunk=500 : Tur başına maç}';

    protected $description = 'Rakip matchup sayaçlarını eldeki maçlardan geriye dönük doldurur';

    public function handle(BuildAggregationService $agg): int
    {
        $cutoff = now()->subMinutes(30); // kuyruktaki yeni job'larla yarışma

        $total = ProcessedMatch::where('matchup_done', false)
            ->where('processed_at', '<', $cutoff)->count();
        $this->info("Bekleyen maç: {$total}");

        $done = $skipped = 0;
        while (true) {
            $batch = ProcessedMatch::where('matchup_done', false)
                ->where('processed_at', '<', $cutoff)
                ->orderBy('match_id')
                ->limit((int) $this->option('chunk'))
                ->pluck('match_id');

            if ($batch->isEmpty()) {
                break;
            }

            $acc = [];
            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                if (! $data) {
                    $skipped++; // ham veri prune edilmiş
                    continue;
                }
                foreach ($agg->matchupRows($data) as [$patch, $champ, $pos, $opp, $win]) {
                    $k = "{$patch}|{$champ}|{$pos}|{$opp}";
                    $acc[$k] ??= [$patch, $champ, $pos, $opp, 0, 0];
                    $acc[$k][4]++;
                    if ($win) {
                        $acc[$k][5]++;
                    }
                }
                $done++;
            }

            $now = now()->toDateTimeString();
            foreach (array_chunk(array_values($acc), 500) as $rows) {
                $ph = [];
                $bind = [];
                foreach ($rows as $r) {
                    $ph[] = '(?,?,?,?,?,?,?,?)';
                    array_push($bind, $r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $now, $now);
                }
                DB::statement(
                    'INSERT INTO champion_matchups (patch, champion_id, position, opponent_id, games, wins, created_at, updated_at) VALUES '
                    . implode(',', $ph)
                    . ' ON DUPLICATE KEY UPDATE games = games + VALUES(games), wins = wins + VALUES(wins), updated_at = VALUES(updated_at)',
                    $bind,
                );
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['matchup_done' => true]);
            $this->info("  işlendi: {$done} · veri yok: {$skipped}");
        }

        $this->info("Bitti — işlenen: {$done}, ham verisi olmayan: {$skipped}");

        return self::SUCCESS;
    }
}
