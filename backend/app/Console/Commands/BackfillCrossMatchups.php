<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Bot lane ÇAPRAZ eşleşmelerini (ADC ↔ karşı SUPPORT) eldeki maçlardan doldurur.
 * Riot API'ye GİTMEZ — stored `matches` ham verisinden okur.
 *
 * Aynı koridor düellosundan farkı: bu satırlar daha önce hiç yazılmadığı için
 * games/wins VE n_stats/KDA birlikte doldurulur (diğer iki backfill komutu
 * birbirinin payını tamamlıyordu; burada ikisi de sıfırdan).
 *
 * Bayrak: cross_done. matchup_done/matchup_stats_done'a DOKUNMAZ → aynı maç
 * ikisinde de sayılsa bile mükerrer artış olmaz.
 */
class BackfillCrossMatchups extends Command
{
    protected $signature = 'builds:backfill-cross {--chunk=500 : Tur başına maç}';

    protected $description = 'champion_matchups bot lane çapraz satırlarını (ADC↔karşı SUP) doldurur';

    public function handle(BuildAggregationService $agg): int
    {
        $cutoff = now()->subMinutes(30); // kuyruktaki yeni job'larla yarışma

        $total = ProcessedMatch::where('cross_done', false)
            ->where('processed_at', '<', $cutoff)->count();
        $this->info("Bekleyen maç: {$total}");

        $done = $skipped = 0;
        while (true) {
            $batch = ProcessedMatch::where('cross_done', false)
                ->where('processed_at', '<', $cutoff)
                ->orderBy('match_id')
                ->limit((int) $this->option('chunk'))
                ->pluck('match_id');

            if ($batch->isEmpty()) {
                break;
            }

            // [patch|champ|pos|opp|oppPos] => [patch, champ, pos, opp, oppPos, games, wins, n, k, d, a, kp, dmg]
            $acc = [];
            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                if (! $data) {
                    $skipped++; // ham veri prune edilmiş (bayrak yine set edilir, tekrar denenmesin)
                    continue;
                }
                foreach ($agg->matchupRows($data) as [$patch, $champ, $pos, $opp, $oppPos, $win, $k, $d, $as, $kp, $dmg]) {
                    if ($oppPos === $pos) {
                        continue; // aynı koridor düellosu — diğer backfill'lerin işi
                    }
                    $key = "{$patch}|{$champ}|{$pos}|{$opp}|{$oppPos}";
                    $acc[$key] ??= [$patch, $champ, $pos, $opp, $oppPos, 0, 0, 0, 0, 0, 0, 0, 0];
                    $acc[$key][5]++;               // games
                    $acc[$key][6] += $win ? 1 : 0; // wins
                    $acc[$key][7]++;               // n_stats
                    $acc[$key][8] += $k;
                    $acc[$key][9] += $d;
                    $acc[$key][10] += $as;
                    $acc[$key][11] += $kp;
                    $acc[$key][12] += $dmg;
                }
                $done++;
            }

            $now = now()->toDateTimeString();
            foreach (array_chunk(array_values($acc), 500) as $rows) {
                $ph = [];
                $bind = [];
                foreach ($rows as $r) {
                    $ph[] = '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
                    array_push(
                        $bind,
                        $r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $r[6],
                        $r[7], $r[8], $r[9], $r[10], $r[11], $r[12], $now, $now
                    );
                }
                DB::statement(
                    'INSERT INTO champion_matchups (patch, champion_id, position, opponent_id, opponent_position, games, wins, n_stats, sum_kills, sum_deaths, sum_assists, sum_kp, sum_dmg, created_at, updated_at) VALUES '
                    . implode(',', $ph)
                    . ' ON DUPLICATE KEY UPDATE games = games + VALUES(games), wins = wins + VALUES(wins),'
                    . ' n_stats = n_stats + VALUES(n_stats), sum_kills = sum_kills + VALUES(sum_kills),'
                    . ' sum_deaths = sum_deaths + VALUES(sum_deaths), sum_assists = sum_assists + VALUES(sum_assists),'
                    . ' sum_kp = sum_kp + VALUES(sum_kp), sum_dmg = sum_dmg + VALUES(sum_dmg), updated_at = VALUES(updated_at)',
                    $bind,
                );
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['cross_done' => true]);
            $this->info("  işlendi: {$done} · veri yok: {$skipped}");
        }

        $this->info("Bitti — işlenen: {$done}, ham verisi olmayan: {$skipped}");

        return self::SUCCESS;
    }
}
