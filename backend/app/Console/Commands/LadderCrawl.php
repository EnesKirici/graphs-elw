<?php

namespace App\Console\Commands;

use App\Models\CrawlPlayer;
use App\Models\LadderBucket;
use App\Services\RiotApi\RiotApiService;
use Illuminate\Console\Command;

/**
 * TR ladder tarayıcı.
 *  - Apex ligler (Challenger/GM/Master) → ladder_buckets + crawl_players (priority=high)
 *  - (TODO) Diamond ve altı → League-V4 entries sayfalama
 *
 * ⚠️ Production key gerektirir (apex + entries çok istek). Dev key ile çalıştırma.
 */
class LadderCrawl extends Command
{
    protected $signature = 'ladder:crawl {--queue=RANKED_SOLO_5x5}';

    protected $description = 'TR ladder tarar: apex ligler → ladder_buckets (percentile) + crawl_players havuzu';

    public function handle(RiotApiService $api): int
    {
        $queue = $this->option('queue');
        $region = config('riot.platform', 'tr1');

        foreach (['challenger', 'grandmaster', 'master'] as $tierKey) {
            try {
                $league = $api->platformRequest("/lol/league/v4/{$tierKey}leagues/by-queue/{$queue}");
            } catch (\Throwable $e) {
                $this->warn(strtoupper($tierKey) . ' alınamadı: ' . $e->getMessage());
                continue;
            }

            $tier = $league['tier'] ?? strtoupper($tierKey);
            $entries = $league['entries'] ?? [];

            // Apex = tek division (I). Histogram için oyuncu sayısı.
            LadderBucket::updateOrCreate(
                ['region' => $region, 'queue' => $queue, 'tier' => $tier, 'division' => 'I'],
                ['player_count' => count($entries)],
            );

            foreach ($entries as $e) {
                $puuid = $e['puuid'] ?? null;
                if (! $puuid) {
                    // Bazı bölgeler entries'te puuid vermez → Summoner-V4 by-summonerId ile çözülmeli (TODO)
                    continue;
                }
                CrawlPlayer::updateOrCreate(
                    ['puuid' => $puuid],
                    ['region' => $region, 'tier' => $tier, 'priority' => 'high'],
                );
            }

            $this->info("{$tier}: " . count($entries) . ' oyuncu');
        }

        // TODO: Diamond..Iron için /lol/league/v4/entries/{queue}/{tier}/{division}?page=N
        //       sayfalama döngüsü → ladder_buckets'ı tam doldur (percentile hassasiyeti).

        return self::SUCCESS;
    }
}
