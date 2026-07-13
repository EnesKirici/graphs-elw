<?php

namespace App\Console\Commands;

use App\Services\ChampionStatsService;
use App\Services\MetaService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class RebuildChampionStats extends Command
{
    protected $signature = 'stats:rebuild';

    protected $description = 'matches tablosundaki maçlardan şampiyon istatistik sayaçlarını (champion_stats) yeniden hesaplar';

    public function handle(ChampionStatsService $stats): int
    {
        $this->info('Şampiyon istatistikleri yeniden hesaplanıyor...');
        $start = microtime(true);

        $result = $stats->aggregateFromMatches();
        $duoPairs = $stats->aggregateDuosFromMatches(); // ADC+Support sinerji sayaçları
        Cache::forget(MetaService::DASHBOARD_STATS_CACHE_KEY); // dashboard yeni veriyi hemen göstersin

        $secs = round(microtime(true) - $start, 2);
        $this->info("Bitti ({$secs}s).");
        $this->line("  İşlenen maç : {$result['matches']}");
        $this->line("  Sayaç satırı: {$result['statRows']}");
        $this->line("  Duo ikili   : {$duoPairs}");
        foreach ($result['patches'] as $patch => $games) {
            $this->line("  Patch {$patch}: {$games} maç");
        }

        return self::SUCCESS;
    }
}
