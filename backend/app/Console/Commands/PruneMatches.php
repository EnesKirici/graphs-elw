<?php

namespace App\Console\Commands;

use App\Services\RetentionService;
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

    public function handle(RetentionService $retention): int
    {
        $report = $retention->report();
        if ($report['cutoff'] === null) {
            $this->error('Prune eşiği yok (config elwgraphs.meta.patch_starts boş?) — güvenlik için iptal.');
            return self::FAILURE;
        }

        $this->info('Tutulan patch\'ler : ' . implode(', ', $report['keptPatches']));
        $this->info('Eşik (bundan eski silinir): ' . $report['cutoff']);
        $this->line("  Toplam maç        : {$report['totalMatches']}");
        $this->line("  Silinecek (eski)  : {$report['prunableMatches']}");
        $this->line("  Kalacak           : {$report['keptMatches']}");
        $this->line("  Tahmini kazanç    : ~{$report['estFreedMb']} MB");

        if ($report['prunableMatches'] === 0) {
            $this->info('Silinecek eski maç yok.');
            return self::SUCCESS;
        }

        if (! $this->option('force')) {
            $this->warn('Önizleme (dry-run) — hiçbir şey silinmedi. Gerçekten silmek için: --force');
            return self::SUCCESS;
        }

        $r = $retention->prune();
        $this->info("Silindi: {$r['deletedMatches']} maç + {$r['deletedTimelines']} timeline. Kalan maç: {$r['remaining']}");
        $this->warn('İpucu: sayaçları tazelemek için `php artisan stats:rebuild` çalıştır.');

        return self::SUCCESS;
    }
}
