<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;

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

            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                if ($data) {
                    $agg->backfillRuneConditionals($data);
                    $done++;
                } else {
                    $skipped++; // ham veri prune edilmiş — işlenemez
                }
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['rune_k_done' => true]);
            $this->info("  işlendi: {$done} · veri yok: {$skipped}");
        }

        $this->info("Bitti — işlenen: {$done}, ham verisi olmayan: {$skipped}");

        return self::SUCCESS;
    }
}
