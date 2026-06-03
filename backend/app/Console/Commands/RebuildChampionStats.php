<?php

namespace App\Console\Commands;

use App\Services\ChampionStatsService;
use Illuminate\Console\Command;

class RebuildChampionStats extends Command
{
    protected $signature = 'stats:rebuild';

    protected $description = 'matches tablosundaki maçlardan şampiyon istatistik sayaçlarını (champion_stats) yeniden hesaplar';

    public function handle(ChampionStatsService $stats): int
    {
        $this->info('Şampiyon istatistikleri yeniden hesaplanıyor...');
        $start = microtime(true);

        $result = $stats->aggregateFromMatches();

        $secs = round(microtime(true) - $start, 2);
        $this->info("Bitti ({$secs}s).");
        $this->line("  İşlenen maç : {$result['matches']}");
        $this->line("  Sayaç satırı: {$result['statRows']}");
        foreach ($result['patches'] as $patch => $games) {
            $this->line("  Patch {$patch}: {$games} maç");
        }

        return self::SUCCESS;
    }
}
