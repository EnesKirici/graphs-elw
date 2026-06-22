<?php

namespace App\Console\Commands;

use App\Services\RiotApi\SpectatorService;
use App\Services\RiotApi\LiveGameService;
use App\Services\RiotApi\SummonerService;
use App\Services\RiotApi\RiotApiService;
use Illuminate\Console\Command;

/**
 * Canlı bir maçı yakalayıp frontend fixture JSON'una yazar (gerçek test verisi).
 * Aynı zamanda kaç Riot isteği gittiğini ölçer.
 *
 * Kullanım:
 *   php artisan live:capture "Faker#KR1"     # belirli oyuncu (oyundaysa)
 *   php artisan live:capture <puuid>          # puuid ile
 *   php artisan live:capture                  # featured games'ten ilk canlı oyun
 *   php artisan live:capture --out=path.json  # özel çıktı yolu
 */
class CaptureLiveGame extends Command
{
    protected $signature = 'live:capture {target? : "Name#TAG" veya puuid; boşsa featured games} {--out= : çıktı JSON yolu}';
    protected $description = 'Canlı maçı yakalayıp fixture JSON yaz + giden Riot isteğini say';

    public function handle(SpectatorService $spectator, LiveGameService $live, SummonerService $summoner): int
    {
        $target = $this->argument('target');
        $out = $this->option('out') ?: base_path('../frontend/src/lib/live-fixture.json');

        $before = RiotApiService::getRateLimitStatus()['requests'] ?? 0;

        $game = null;
        $profile = null;

        try {
            if ($target && str_contains($target, '#')) {
                [$n, $t] = explode('#', $target, 2);
                $profile = $summoner->searchByRiotId(trim($n), trim($t));
                $raw = $spectator->getActiveGame($profile['puuid']);
                if (!$raw) {
                    $this->error("{$target} şu anda bir maçta değil.");
                    return self::FAILURE;
                }
                $game = $live->enrichGame($raw, $profile['puuid']);
            } elseif ($target) {
                $raw = $spectator->getActiveGame($target);
                if (!$raw) {
                    $this->error('Bu puuid şu anda oyunda değil.');
                    return self::FAILURE;
                }
                $game = $live->enrichGame($raw, $target);
            } else {
                $featured = $spectator->getFeaturedGames();
                $list = $featured['gameList'] ?? [];
                if (empty($list)) {
                    $this->error('Featured oyun bulunamadı.');
                    return self::FAILURE;
                }
                $game = $live->enrichGame($list[0], null);
                $this->warn('Featured games kullanıldı — participant puuid olmayabilir; rank/enrichment eksik kalabilir.');
            }
        } catch (\Throwable $e) {
            $this->error('Yakalama hatası [' . $e->getCode() . ']: ' . $e->getMessage());
            return self::FAILURE;
        }

        // Her oyuncu için ağır enrichment (rozet, son maçlar, build)
        $all = array_merge($game['allyTeam'] ?? [], $game['enemyTeam'] ?? []);
        $players = [];
        $this->info('Oyuncu verileri toplanıyor (' . count($all) . ' oyuncu)...');
        $bar = $this->output->createProgressBar(count($all));
        foreach ($all as $p) {
            $pid = $p['puuid'] ?? '';
            if ($pid !== '' && empty($p['isBot'])) {
                try {
                    $players[$pid] = $live->getPlayerEnrichment($pid, $p['champion']['name'] ?? null);
                } catch (\Throwable $e) {
                    // kısmi yakalama — devam et
                }
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();

        $game['mock'] = true;
        if ($profile) {
            $game['profile'] = [
                'gameName'    => $profile['gameName'],
                'tagLine'     => $profile['tagLine'],
                'profileIcon' => $profile['profileIcon'],
            ];
        }
        $game['players'] = $players;

        $json = json_encode($game, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (@file_put_contents($out, $json) === false) {
            $this->error("Dosya yazılamadı: {$out}");
            return self::FAILURE;
        }

        $after = RiotApiService::getRateLimitStatus()['requests'] ?? 0;

        $this->newLine();
        $this->info("✓ Fixture yazıldı: {$out}");
        $this->line("  Oyuncu (zenginleştirilen): " . count($players) . '/' . count($all));
        $this->line("  Giden Riot isteği (yaklaşık): " . ($after - $before));
        $this->line('  Frontend: /live-game/<name>/<tag>?mock=1 ile görüntüle.');

        return self::SUCCESS;
    }
}
