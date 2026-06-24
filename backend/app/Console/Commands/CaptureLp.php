<?php

namespace App\Console\Commands;

use App\Models\CachedPlayer;
use App\Models\TrackedPlayer;
use App\Services\LpTrackingService;
use App\Services\RiotApi\LeagueService;
use App\Services\RiotApi\MatchDataService;
use App\Services\RiotApi\MatchService;
use App\Services\RiotApi\SummonerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Takip edilen hesapların LP/rank durumunu çeker ve her YENİ ranked maça anlık LP
 * snapshot'ı yazar → maç-başına LP değişimi güvenilir olur. Sık çalışmalı (~10dk).
 */
class CaptureLp extends Command
{
    protected $signature = 'lp:capture {--limit=20 : İşlenecek maksimum hesap}';

    protected $description = 'Takip edilen hesapların LP/rank durumunu çeker, yeni ranked maça LP snapshot yazar';

    public function handle(
        SummonerService $summoner,
        LeagueService $league,
        MatchDataService $matchData,
        LpTrackingService $lpTracking,
        MatchService $matchService,
    ): int {
        $players = TrackedPlayer::where('active', true)
            ->orderByRaw('last_tracked_at IS NOT NULL, last_tracked_at') // hiç çekilmeyen / en eski önce
            ->limit((int) $this->option('limit'))
            ->get();

        if ($players->isEmpty()) {
            $this->info('Takip edilen aktif hesap yok.');
            return self::SUCCESS;
        }

        $totalSnap = 0;
        foreach ($players as $tp) {
            $label = "{$tp->game_name}#{$tp->tag_line}";
            try {
                // 1. puuid çöz (yoksa) — account-v1, kalıcı, 1 kez.
                $puuid = $tp->puuid;
                if (!$puuid) {
                    $profile = $summoner->searchByRiotId($tp->game_name, $tp->tag_line);
                    $puuid = $profile['puuid'];
                    $tp->puuid = $puuid;
                    $tp->save();
                }

                // 2. ranked'i TAZE çek (30dk cache bayat LP vermesin).
                Cache::forget("league:ranked:{$puuid}");
                $ranked = $league->getRankedInfo($puuid);

                // 3. ranked maç id'leri TAZE — en yeni maçı yakala.
                Cache::forget("season_match_ids:v2:{$puuid}:420");
                Cache::forget("season_match_ids:v2:{$puuid}:440");
                $soloIds = $matchData->getSeasonMatchIds($puuid, 420);
                $flexIds = $matchData->getSeasonMatchIds($puuid, 440);

                // 4. snapshot: her kuyruğun en yeni ranked maçına anlık LP (maç-başına LP zinciri).
                $newest = ['solo' => $soloIds[0] ?? null, 'flex' => $flexIds[0] ?? null];
                $written = $lpTracking->recordSnapshots($puuid, $ranked, $newest);
                $totalSnap += $written;

                // 5. cached_players güncelle (arama/leaderboard + meta:site_stats tracked sayısı).
                $solo = $ranked['solo'] ?? null;
                CachedPlayer::updateOrCreate(
                    ['puuid' => $puuid],
                    [
                        'game_name' => $tp->game_name,
                        'tag_line'  => $tp->tag_line,
                        'tier'      => $solo['tier'] ?? null,
                        'rank'      => $solo['rank'] ?? null,
                        'queue'     => 'RANKED_SOLO_5x5',
                        'lp'        => $solo['lp'] ?? null,
                        'wins'      => $solo['wins'] ?? null,
                        'losses'    => $solo['losses'] ?? null,
                    ],
                );

                // 6. imleç.
                $tp->last_tracked_at = now();
                $tp->last_match_id = $newest['solo'] ?? $newest['flex'] ?? $tp->last_match_id;
                $tp->save();

                // 7. Prewarm: sezon maç ÖZETLERİNİ de kur (DB-first; eksikleri rate-limit
                //    bütçesiyle çeker) → bu hesabın profili kimse bakmadan hazır, anında açılır.
                try {
                    $matchService->ensureSeasonSummaries($puuid);
                } catch (\Exception $e) {}

                $rankStr = $solo ? "{$solo['tier']} {$solo['rank']} {$solo['lp']}LP" : 'Unranked';
                $this->line("  {$label}: {$rankStr}  (+{$written} snapshot)");
            } catch (\Exception $e) {
                $code = $e->getCode();
                $this->warn("  {$label}: hata ({$code}) {$e->getMessage()}");
                if ($code === 429) {
                    $this->warn('  Rate limit — kalan hesaplar atlanıyor.');
                    break;
                }
            }
        }

        $this->info("Bitti. {$totalSnap} yeni LP snapshot yazıldı.");

        return self::SUCCESS;
    }
}
