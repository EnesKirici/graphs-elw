<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Eski işlenmiş maçlar için keystone-koşullu rün sayaçlarını (rune_minor_k/shard_k)
 * doldurur. Riot API'ye GİTMEZ — matches tablosundaki ham veriden okur.
 *
 * Çift sayım koruması: processed_matches.rune_k_done bayrağı. Yeni maçları
 * ProcessMatchJob zaten bayraklı işler; bu komut yalnız bayrağı 0 olanları tarar.
 * Ham verisi silinmiş (prune) maçlar işlenemez → bayrak yine 1 yapılır (atlanır).
 */
class BackfillRuneConditionals extends Command
{
    protected $signature = 'builds:backfill-runes {--chunk=500 : Tur başına maç}';

    protected $description = 'Keystone-koşullu rün sayaçlarını eldeki maçlardan geriye dönük doldurur';

    public function handle(BuildAggregationService $agg): int
    {
        // Şu anda kuyrukta işlenen YENİ maçlarla yarışmamak için yalnız eski
        // kayıtlar taranır (yeni job'lar bayrağı kendileri 1 yapar).
        $cutoff = now()->subMinutes(30);

        $total = ProcessedMatch::where('rune_k_done', false)
            ->where('processed_at', '<', $cutoff)->count();
        $this->info("Bekleyen maç: {$total}");

        $done = $skipped = 0;
        while (true) {
            $batch = ProcessedMatch::where('rune_k_done', false)
                ->where('processed_at', '<', $cutoff)
                ->orderBy('match_id')
                ->limit((int) $this->option('chunk'))
                ->pluck('match_id');

            if ($batch->isEmpty()) {
                break;
            }

            // Chunk'ın tüm satırlarını bellekte topla → tek toplu upsert.
            // (Maç başına ~240 tekil Eloquent sorgusu 19 saat sürüyordu.)
            $acc = [];
            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                if (! $data) {
                    $skipped++; // ham veri prune edilmiş — işlenemez
                    continue;
                }
                foreach ($agg->runeConditionalRows($data) as [$patch, $champ, $pos, $cat, $key, $win]) {
                    $k = "{$patch}|{$champ}|{$pos}|{$cat}|{$key}";
                    $acc[$k] ??= [$patch, $champ, $pos, $cat, $key, 0, 0];
                    $acc[$k][5]++;
                    if ($win) {
                        $acc[$k][6]++;
                    }
                }
                $done++;
            }

            $now = now()->toDateTimeString();
            foreach (array_chunk(array_values($acc), 500) as $rows) {
                $ph = [];
                $bind = [];
                foreach ($rows as $r) {
                    $ph[] = '(?,?,?,?,?,?,?,?,?)';
                    array_push($bind, $r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $r[6], $now, $now);
                }
                DB::statement(
                    'INSERT INTO champion_builds (patch, champion_id, position, category, item_key, games, wins, created_at, updated_at) VALUES '
                    . implode(',', $ph)
                    . ' ON DUPLICATE KEY UPDATE games = games + VALUES(games), wins = wins + VALUES(wins), updated_at = VALUES(updated_at)',
                    $bind,
                );
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['rune_k_done' => true]);
            $this->info("  işlendi: {$done} · veri yok: {$skipped}");
        }

        $this->info("Bitti — işlenen: {$done}, ham verisi olmayan: {$skipped}");

        return self::SUCCESS;
    }
}
