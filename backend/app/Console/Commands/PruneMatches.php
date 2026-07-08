<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\MatchTimeline;
use App\Services\PatchService;
use Illuminate\Console\Command;

/**
 * Eski maçları temizler: yalnızca tutulan patch penceresini (güncel + önceki,
 * config elwgraphs.meta.keep_patches) bırakır, öncesini siler. DB'yi şişirmez +
 * meta doğal olarak güncel patch'e oturur.
 *
 * Silme geri alınamaz → VARSAYILAN dry-run (sadece sayar). Gerçek silme: --force.
 * Silinen maçın profil detayı sonradan istenirse Riot'tan yeniden çekilir (DB-first
 * fallback), match_summaries/lp_snapshots ayrı tablolarda → profiller bozulmaz.
 */
class PruneMatches extends Command
{
    protected $signature = 'matches:prune {--force : Gerçekten sil (yoksa sadece önizleme)}';

    protected $description = 'Tutulan patch penceresinden (güncel+önceki) eski maçları siler';

    public function handle(PatchService $patch): int
    {
        $cutoff = $patch->keepSince();
        if (! $cutoff) {
            $this->error('Prune eşiği yok (config elwgraphs.meta.patch_starts boş?) — güvenlik için iptal.');
            return self::FAILURE;
        }
        $cutoffMs = $cutoff->getTimestampMs();
        $kept = $patch->keptPatches();

        $old = MatchRecord::where('game_creation', '<', $cutoffMs);
        $oldCount = $old->count();
        $total = MatchRecord::count();

        $this->info('Tutulan patch\'ler : ' . implode(', ', $kept));
        $this->info('Eşik (bundan eski silinir): ' . $cutoff->toDateString());
        $this->line("  Toplam maç        : {$total}");
        $this->line("  Silinecek (eski)  : {$oldCount}");
        $this->line('  Kalacak           : ' . ($total - $oldCount));

        if ($oldCount === 0) {
            $this->info('Silinecek eski maç yok.');
            return self::SUCCESS;
        }

        if (! $this->option('force')) {
            $this->warn('Önizleme (dry-run) — hiçbir şey silinmedi. Gerçekten silmek için: --force');
            return self::SUCCESS;
        }

        // İlişkili timeline'ları da temizle (aynı match_id'ler — alt sorgu, farklı tablo).
        $timelinesDeleted = MatchTimeline::whereIn(
            'match_id',
            MatchRecord::where('game_creation', '<', $cutoffMs)->select('match_id')
        )->delete();

        $deleted = MatchRecord::where('game_creation', '<', $cutoffMs)->delete();

        $this->info("Silindi: {$deleted} maç + {$timelinesDeleted} timeline. Kalan maç: " . MatchRecord::count());
        $this->warn('İpucu: sayaçları tazelemek için `php artisan stats:rebuild` çalıştır.');

        return self::SUCCESS;
    }
}
