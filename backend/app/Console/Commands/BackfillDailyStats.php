<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Günlük trend sayaçlarını (champion_daily_stats + stat_days) eldeki maçlardan doldurur.
 * Riot API'ye GİTMEZ — stored `matches` ham verisinden okur.
 *
 * Yalnız SON N GÜNÜ işler (varsayılan 35): grafik 30 gün gösteriyor, daha eskisini
 * doldurmak boşuna disk ve zaman. Bayrak: daily_done.
 */
class BackfillDailyStats extends Command
{
    protected $signature = 'stats:backfill-daily
        {--days=35 : Kaç günlük geçmiş işlensin}
        {--chunk=500 : Tur başına maç}';

    protected $description = 'champion_daily_stats günlük sayaçlarını eldeki maçlardan doldurur';

    public function handle(BuildAggregationService $agg): int
    {
        $days = max(1, (int) $this->option('days'));
        $sinceMs = Carbon::now()->subDays($days)->getTimestampMs();

        // Yalnız son N günün maçları; eskiler bayrağı işaretlenip geçilir ki
        // her turda yeniden taranmasınlar.
        $oldIds = ProcessedMatch::where('daily_done', false)
            ->whereIn('match_id', MatchRecord::where('game_creation', '<', $sinceMs)->select('match_id'))
            ->limit(50000)
            ->pluck('match_id');
        if ($oldIds->isNotEmpty()) {
            ProcessedMatch::whereIn('match_id', $oldIds)->update(['daily_done' => true]);
            $this->line("  pencere dışı (atlandı): {$oldIds->count()}");
        }

        $total = ProcessedMatch::where('daily_done', false)->count();
        $this->info("Bekleyen maç (son {$days} gün): {$total}");

        $done = $skipped = 0;
        while (true) {
            $batch = ProcessedMatch::where('daily_done', false)
                ->orderBy('match_id')
                ->limit((int) $this->option('chunk'))
                ->pluck('match_id');

            if ($batch->isEmpty()) {
                break;
            }

            // day => matches   ve   "day|champ|pos" => [games, wins, bans]
            $dayTotals = [];
            $acc = [];

            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                $info = $data['info'] ?? null;
                $created = (int) ($info['gameCreation'] ?? 0);
                if (! $info || $created <= 0) {
                    $skipped++;
                    continue;
                }
                $day = Carbon::createFromTimestampMs($created)->toDateString();
                $dayTotals[$day] = ($dayTotals[$day] ?? 0) + 1;

                foreach ($agg->dailyRowsFor($info) as [$champ, $pos, $g, $w, $b]) {
                    $k = "{$day}|{$champ}|{$pos}";
                    $acc[$k] ??= [0, 0, 0];
                    $acc[$k][0] += $g;
                    $acc[$k][1] += $w;
                    $acc[$k][2] += $b;
                }
                $done++;
            }

            $now = now()->toDateTimeString();

            foreach ($dayTotals as $day => $n) {
                DB::statement(
                    'INSERT INTO stat_days (day, matches, created_at, updated_at) VALUES (?,?,?,?)'
                    . ' ON DUPLICATE KEY UPDATE matches = matches + VALUES(matches), updated_at = VALUES(updated_at)',
                    [$day, $n, $now, $now]
                );
            }

            foreach (array_chunk($acc, 400, true) as $part) {
                $ph = [];
                $bind = [];
                foreach ($part as $k => [$g, $w, $b]) {
                    [$day, $champ, $pos] = explode('|', $k, 3);
                    $ph[] = '(?,?,?,?,?,?,?,?)';
                    array_push($bind, $day, $champ, $pos, $g, $w, $b, $now, $now);
                }
                DB::statement(
                    'INSERT INTO champion_daily_stats (day, champion_id, position, games, wins, bans, created_at, updated_at) VALUES '
                    . implode(',', $ph)
                    . ' ON DUPLICATE KEY UPDATE games = games + VALUES(games), wins = wins + VALUES(wins),'
                    . ' bans = bans + VALUES(bans), updated_at = VALUES(updated_at)',
                    $bind
                );
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['daily_done' => true]);
            $this->info("  işlendi: {$done} · veri yok: {$skipped}");
        }

        $this->info("Bitti — işlenen: {$done}, atlanan: {$skipped}");

        return self::SUCCESS;
    }
}
