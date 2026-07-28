<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Eski maçlar için champion_matchups'ın KDA/hasar/KP toplamlarını doldurur.
 * Riot API'ye GİTMEZ — stored `matches` ham verisinden okur.
 * games/wins'e DOKUNMAZ (onlar matchup_done ile zaten sayıldı; burada yalnız
 * n_stats + KDA/hasar eklenir → ortalama = toplam/n_stats). Bayrak: matchup_stats_done.
 */
class BackfillMatchupStats extends Command
{
    protected $signature = 'builds:backfill-matchup-stats {--chunk=500 : Tur başına maç}';

    protected $description = 'champion_matchups KDA/hasar toplamlarını eldeki maçlardan doldurur';

    public function handle(BuildAggregationService $agg): int
    {
        $cutoff = now()->subMinutes(30); // kuyruktaki yeni job'larla yarışma

        $total = ProcessedMatch::where('matchup_stats_done', false)
            ->where('processed_at', '<', $cutoff)->count();
        $this->info("Bekleyen maç: {$total}");

        $done = $skipped = 0;
        while (true) {
            $batch = ProcessedMatch::where('matchup_stats_done', false)
                ->where('processed_at', '<', $cutoff)
                ->orderBy('match_id')
                ->limit((int) $this->option('chunk'))
                ->pluck('match_id');

            if ($batch->isEmpty()) {
                break;
            }

            // [patch|champ|pos|opp] => [patch, champ, pos, opp, n_stats, kills, deaths, assists, kp, dmg]
            $acc = [];
            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                if (! $data) {
                    $skipped++; // ham veri prune edilmiş → KDA yok (bayrak yine set edilir, tekrar denenmesin)
                    continue;
                }
                foreach ($agg->matchupRows($data) as [$patch, $champ, $pos, $opp, $win, $k, $d, $as, $kp, $dmg]) {
                    $key = "{$patch}|{$champ}|{$pos}|{$opp}";
                    $acc[$key] ??= [$patch, $champ, $pos, $opp, 0, 0, 0, 0, 0, 0];
                    $acc[$key][4]++;          // n_stats
                    $acc[$key][5] += $k;      // sum_kills
                    $acc[$key][6] += $d;      // sum_deaths
                    $acc[$key][7] += $as;     // sum_assists
                    $acc[$key][8] += $kp;     // sum_kp
                    $acc[$key][9] += $dmg;    // sum_dmg
                }
                $done++;
            }

            $now = now()->toDateTimeString();
            foreach (array_chunk(array_values($acc), 500) as $rows) {
                $ph = [];
                $bind = [];
                foreach ($rows as $r) {
                    $ph[] = '(?,?,?,?,?,?,?,?,?,?,?,?)';
                    array_push($bind, $r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $r[6], $r[7], $r[8], $r[9], $now, $now);
                }
                // games/wins INSERT'te 0 (edge; normalde satır zaten var), UPDATE'te DOKUNULMAZ.
                DB::statement(
                    'INSERT INTO champion_matchups (patch, champion_id, position, opponent_id, n_stats, sum_kills, sum_deaths, sum_assists, sum_kp, sum_dmg, created_at, updated_at) VALUES '
                    . implode(',', $ph)
                    . ' ON DUPLICATE KEY UPDATE n_stats = n_stats + VALUES(n_stats), sum_kills = sum_kills + VALUES(sum_kills), sum_deaths = sum_deaths + VALUES(sum_deaths), sum_assists = sum_assists + VALUES(sum_assists), sum_kp = sum_kp + VALUES(sum_kp), sum_dmg = sum_dmg + VALUES(sum_dmg), updated_at = VALUES(updated_at)',
                    $bind,
                );
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['matchup_stats_done' => true]);
            $this->info("  işlendi: {$done} · veri yok: {$skipped}");
        }

        $this->info("Bitti — işlenen: {$done}, ham verisi olmayan: {$skipped}");

        return self::SUCCESS;
    }
}
