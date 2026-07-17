<?php

namespace App\Console\Commands;

use App\Models\CrawlPlayer;
use App\Models\LadderBucket;
use App\Services\RiotApi\RiotApiService;
use App\Services\WorkerControlService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * TR ladder tarayıcı — crawl_players havuzunu doldurur.
 *  - Apex ligler (Challenger/GM/Master): tek istekle tüm liste → ladder_buckets + havuz (priority=high)
 *  - Emerald/Diamond: League-V4 entries sayfalama (division başına config kadar sayfa) → havuz (priority=normal)
 *
 * Hangi liglerin taranacağı admin panelden seçilir (worker_tiers). Personal key
 * bütçesine göre entries sayfa sayısı config elwgraphs.worker'da sınırlı tutulur.
 */
class LadderCrawl extends Command
{
    private const APEX = ['CHALLENGER' => 'challenger', 'GRANDMASTER' => 'grandmaster', 'MASTER' => 'master'];
    private const PAGED = ['EMERALD', 'DIAMOND'];
    private const DIVISIONS = ['I', 'II', 'III', 'IV'];

    protected $signature = 'ladder:crawl {--queue=RANKED_SOLO_5x5} {--force : worker_enabled kapalıyken de çalıştır}';

    protected $description = 'TR ladder tarar: seçili ligler → crawl_players havuzu (+apex ladder_buckets)';

    public function handle(RiotApiService $api, WorkerControlService $control): int
    {
        if (! $control->isEnabled() && ! $this->option('force')) {
            $this->info('Worker kapalı (worker_enabled). --force ile elle çalıştırabilirsin.');
            return self::SUCCESS;
        }

        $queue = $this->option('queue');
        $region = config('riot.platform', 'tr1');
        $tiers = $control->tiers();

        if (empty($tiers)) {
            $this->warn('Seçili lig yok (worker_tiers boş).');
            return self::SUCCESS;
        }

        // Apex ligler — tek istekte tüm liste (histogram + havuz).
        foreach (self::APEX as $tier => $endpointKey) {
            if (! in_array($tier, $tiers, true)) {
                continue;
            }
            try {
                $league = $api->platformRequest("/lol/league/v4/{$endpointKey}leagues/by-queue/{$queue}");
            } catch (\Throwable $e) {
                $this->warn("{$tier} alınamadı: " . $e->getMessage());
                continue;
            }

            $entries = $league['entries'] ?? [];

            // Apex = tek division (I). Histogram için oyuncu sayısı.
            LadderBucket::updateOrCreate(
                ['region' => $region, 'queue' => $queue, 'tier' => $tier, 'division' => 'I'],
                ['player_count' => count($entries)],
            );

            $added = $this->addToPool($entries, $region, $tier, 'high');
            $this->info("{$tier}: " . count($entries) . " oyuncu (havuza {$added})");
        }

        // Emerald/Diamond — entries sayfalama (division başına sınırlı sayfa → örneklem havuzu).
        // NOT: sınırlı sayfa TAM sayım değildir → ladder_buckets'a YAZILMAZ (percentile bozulmasın).
        $pages = max(1, (int) config('elwgraphs.worker.entry_pages_per_division', 1));

        foreach (self::PAGED as $tier) {
            if (! in_array($tier, $tiers, true)) {
                continue;
            }
            $total = 0;
            $added = 0;
            foreach (self::DIVISIONS as $div) {
                for ($page = 1; $page <= $pages; $page++) {
                    try {
                        $entries = $api->platformRequest(
                            "/lol/league/v4/entries/{$queue}/{$tier}/{$div}",
                            ['page' => $page],
                        );
                    } catch (\Throwable $e) {
                        $this->warn("{$tier} {$div} s.{$page} alınamadı: " . $e->getMessage());
                        continue 2; // bu division'ı bırak, sıradakine geç
                    }
                    if (empty($entries)) {
                        break; // bu division'da sayfa bitti
                    }
                    $total += count($entries);
                    $added += $this->addToPool($entries, $region, $tier, 'normal');
                }
            }
            $this->info("{$tier}: {$total} oyuncu tarandı (havuza {$added})");
        }

        Cache::put('worker:last_crawl_at', now()->toDateTimeString(), 60 * 60 * 24 * 7);

        return self::SUCCESS;
    }

    /** Entries listesini havuza ekler; puuid'i olmayan kayıtlar atlanır. */
    private function addToPool(array $entries, string $region, string $tier, string $priority): int
    {
        $added = 0;
        foreach ($entries as $e) {
            $puuid = $e['puuid'] ?? null;
            if (! $puuid) {
                continue; // puuid yoksa Summoner-V4 çözümü gerekir (TODO — istek bütçesi)
            }
            CrawlPlayer::updateOrCreate(
                ['puuid' => $puuid],
                ['region' => $region, 'tier' => $tier, 'priority' => $priority],
            );
            $added++;
        }

        return $added;
    }
}
