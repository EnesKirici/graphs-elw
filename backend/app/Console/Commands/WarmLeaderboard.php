<?php

namespace App\Console\Commands;

use App\Services\Leaderboard\LeaderboardService;
use App\Services\WorkerControlService;
use Illuminate\Console\Command;

/**
 * Leaderboard cache'ini önden doldurur — ziyaretçi Riot'u BEKLEMESİN.
 *
 * Sorun: liste ziyaretçi isteğiyle tembel kuruluyordu. Cache soğukken (ya da lig
 * sekmesi ilk kez açıldığında) o ziyaretçi Riot'un yanıtını inline bekliyordu;
 * ilk 10 oyuncu da yeniyse üstüne 30 kimlik isteği biniyordu → sekme geçişi
 * saniyelerce takılıyordu.
 *
 * Maliyet: kombinasyon başına 1 lig isteği + en fazla bütçe kadar kimlik isteği.
 * cached_players dolduktan sonra kimlik maliyeti 0'a iner → tur başına 6 istek.
 */
class WarmLeaderboard extends Command
{
    protected $signature = 'leaderboard:warm
        {--tier=* : Tazelenecek ligler (varsayılan: hepsi)}
        {--queue=* : Tazelenecek kuyruklar (varsayılan: hepsi)}
        {--force : worker_enabled kapalıyken de çalıştır}';

    protected $description = 'Leaderboard cache\'ini önden doldurur (ziyaretçi soğuk yola düşmesin)';

    public function handle(LeaderboardService $leaderboard, WorkerControlService $control): int
    {
        // Riot key kullanır → diğer zamanlanmış işler gibi worker'a bağlı.
        if (! $control->isEnabled() && ! $this->option('force')) {
            $this->info('Worker kapalı (worker_enabled). --force ile elle çalıştırabilirsin.');
            return self::SUCCESS;
        }

        $tiers = $this->option('tier') ?: LeaderboardService::TIERS;
        $queues = $this->option('queue') ?: LeaderboardService::QUEUES;

        foreach ($tiers as $tier) {
            foreach ($queues as $queue) {
                if (! in_array($tier, LeaderboardService::TIERS, true)
                    || ! in_array($queue, LeaderboardService::QUEUES, true)) {
                    $this->warn("Atlandı (geçersiz): {$tier} / {$queue}");
                    continue;
                }

                try {
                    $data = $leaderboard->warm($tier, $queue);
                    $named = collect($data['entries'])->whereNotNull('name.gameName')->count();
                    $stats = $leaderboard->lastFetchStats();

                    $this->line("  {$tier} / {$queue}: {$data['total']} oyuncu — listede "
                        . count($data['entries']) . ", isimli {$named}"
                        . " (Riot: {$stats['denendi']} deneme, {$stats['basarisiz']} basarisiz)");

                    // Sessiz başarısızlık en kötüsü: liste eksik döner ama sebebi
                    // görünmez. Son hatayı bas ki 429 mı 404 mü anlaşılsın.
                    if ($stats['basarisiz'] > 0) {
                        $this->warn("    son hata: {$stats['sonHata']}");
                    }
                } catch (\Throwable $e) {
                    $this->warn("  {$tier} / {$queue}: hata ({$e->getCode()}) {$e->getMessage()}");

                    // 429'da turu bitir: cooldown aktifken kalan kombinasyonlar da
                    // anında hata alır, denemek yalnız gürültü üretir. Cache eski
                    // hâliyle geçerli kalır, eksik kalan kısmı sonraki tur tamamlar.
                    if ((int) $e->getCode() === 429) {
                        $this->warn('  Rate limit — turun kalanı atlanıyor.');
                        return self::SUCCESS;
                    }
                }
            }
        }

        return self::SUCCESS;
    }
}
