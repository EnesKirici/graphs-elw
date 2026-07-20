<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Mevcut düz-JSON maç/timeline satırlarını gzip'ler (GzipJson cast'e geçiş backfill'i).
 *
 * Kayıpsız ve idempotent: gzip imzalı satırlar atlanır → yarıda kesilirse
 * tekrar çalıştırılabilir, yeni (zaten gzip'li) satırlara dokunmaz.
 * Diskteki alanı OS'e geri vermek için sonunda --optimize ile tablo yeniden inşa edilir
 * (rebuild sırasında geçici olarak tablo boyutu kadar ek disk kullanılır).
 */
class CompressMatches extends Command
{
    private const GZIP_MAGIC = "\x1f\x8b";

    protected $signature = 'matches:compress
        {--chunk=500 : Tur başına satır sayısı}
        {--optimize : Bitince OPTIMIZE TABLE ile diski geri kazan}';

    protected $description = 'matches + match_timelines data kolonlarını gzip\'ler (tek seferlik backfill)';

    public function handle(): int
    {
        foreach (['matches', 'match_timelines'] as $table) {
            $this->compressTable($table);
        }

        if ($this->option('optimize')) {
            foreach (['matches', 'match_timelines'] as $table) {
                $this->info("OPTIMIZE TABLE {$table} (tablo yeniden inşa ediliyor, sürebilir)...");
                DB::statement("OPTIMIZE TABLE {$table}");
            }
        } else {
            $this->warn('İpucu: disk alanını OS\'e geri vermek için --optimize ile çalıştır (veya sonradan OPTIMIZE TABLE).');
        }

        return self::SUCCESS;
    }

    private function compressTable(string $table): void
    {
        $total = DB::table($table)->count();
        $beforeBytes = (int) DB::table($table)->sum(DB::raw('LENGTH(data)'));

        $this->info("{$table}: {$total} satır, data toplamı " . $this->mb($beforeBytes));

        $bar = $this->output->createProgressBar($total);
        $done = 0;
        $skipped = 0;

        DB::table($table)
            ->select('match_id', 'data')
            ->orderBy('match_id')
            ->chunkById((int) $this->option('chunk'), function ($rows) use ($table, $bar, &$done, &$skipped) {
                DB::transaction(function () use ($table, $rows, $bar, &$done, &$skipped) {
                    foreach ($rows as $row) {
                        if (str_starts_with($row->data, self::GZIP_MAGIC)) {
                            $skipped++;
                            $bar->advance();
                            continue;
                        }

                        DB::table($table)
                            ->where('match_id', $row->match_id)
                            ->update(['data' => gzencode($row->data, 6)]);
                        $done++;
                        $bar->advance();
                    }
                });
            }, 'match_id');

        $bar->finish();
        $this->newLine();

        $afterBytes = (int) DB::table($table)->sum(DB::raw('LENGTH(data)'));
        $saved = $beforeBytes > 0 ? round(100 - ($afterBytes / $beforeBytes * 100)) : 0;

        $this->info("{$table}: {$done} sıkıştırıldı, {$skipped} zaten gzip'liydi. "
            . $this->mb($beforeBytes) . ' → ' . $this->mb($afterBytes) . " (%{$saved} kazanç)");
    }

    private function mb(int $bytes): string
    {
        return number_format($bytes / 1048576, 1) . ' MB';
    }
}
