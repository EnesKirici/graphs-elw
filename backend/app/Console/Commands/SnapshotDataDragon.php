<?php

namespace App\Console\Commands;

use App\Services\RiotApi\DataDragonService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * DataDragon veri JSON'larının yerel anlık görüntüsünü alır.
 *
 * DDragon CloudFront üzerinde duruyor; sunucu→CDN yolu koptuğunda (2026-07-23'te
 * sağlayıcının AWS rotası düştü) API'nin tamamı 500 veriyordu. DataDragonService
 * artık CDN'e ulaşamazsa storage/app/ddragon altındaki bu kopyalardan servis eder.
 *
 * CDN'e erişimi OLAN bir makinede çalıştır, ardından dosyaları sunucuya taşı:
 *   php artisan ddragon:snapshot
 *   scp -r backend/storage/app/ddragon elw@sunucu:.../backend/storage/app/
 *
 * Not: CDN erişimi normale döndüğünde her başarılı çekim anlık görüntüyü
 * kendiliğinden tazeler; bu komut yalnızca kopyayı ilk kez oluşturmak veya
 * erişim kopukken elle güncellemek içindir.
 */
class SnapshotDataDragon extends Command
{
    protected $signature = 'ddragon:snapshot {--ver= : Belirli sürüm (boşsa CDN güncel sürümü)}';

    protected $description = 'DataDragon veri JSON\'larını storage/app/ddragon altına kopyalar (CDN çökerse yedek)';

    public function handle(DataDragonService $ddragon): int
    {
        $cdn = config('riot.ddragon_url');
        $lang = 'tr_TR';

        $this->info("Kaynak: {$cdn}");

        // versions.json — sürümü de buradan alırız
        try {
            $versions = Http::timeout(20)->get("{$cdn}/api/versions.json")->json();
        } catch (\Throwable $e) {
            $this->error("versions.json alınamadı: {$e->getMessage()}");
            $this->line('Bu makineden CDN\'e erişim yok; erişimi olan bir makinede çalıştır.');
            return self::FAILURE;
        }

        if (! is_array($versions) || ! isset($versions[0])) {
            $this->error('versions.json beklenen biçimde değil.');
            return self::FAILURE;
        }

        $ddragon->writeSnapshot('versions', $versions);
        $version = $this->option('ver') ?: $versions[0];
        $this->line("Sürüm: {$version}");

        $files = [
            'champion'       => "/cdn/{$version}/data/{$lang}/champion.json",
            'item'           => "/cdn/{$version}/data/{$lang}/item.json",
            'summoner'       => "/cdn/{$version}/data/{$lang}/summoner.json",
            'runesReforged'  => "/cdn/{$version}/data/{$lang}/runesReforged.json",
            'championFull'   => "/cdn/{$version}/data/{$lang}/championFull.json",
        ];

        $failed = 0;
        foreach ($files as $snap => $path) {
            try {
                $data = Http::timeout(60)->get($cdn . $path)->json();
                if (! $data) {
                    throw new \RuntimeException('boş yanıt');
                }
                $ddragon->writeSnapshot($snap, $data);
                $this->line("  ✓ {$snap}");
            } catch (\Throwable $e) {
                $failed++;
                $this->warn("  ✗ {$snap}: {$e->getMessage()}");
            }
        }

        $this->info('Hedef: ' . storage_path('app/ddragon'));

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
