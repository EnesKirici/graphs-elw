<?php

namespace App\Console\Commands;

use App\Services\RiotApi\DataDragonService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

/**
 * DataDragon küçük ikon aynası.
 *
 * Sitede sık kullanılan küçük ikonları (item, şampiyon karesi, yetenek, passive,
 * sihirdar büyüsü, rün, stat shard) frontend/public/dd altına indirir; site bunları
 * DDRAGON_ASSETS_URL ile kendi domain'inden servis eder (TR kullanıcıya dış CDN'den
 * belirgin hızlı). Splash/centered/loading/profileicon BİLEREK dışarıda — büyükler
 * ddragon'da kalır.
 *
 * Idempotent: var olan dosyaları atlar → saatlik cron'da yeni patch çıktığında
 * ayna kendiliğinden dolar. URL yapısı ddragon ile birebir aynıdır
 * (/dd/cdn/{v}/img/...), bu yüzden taban değişimi dışında kod değişikliği gerekmez.
 */
class SyncDataDragonAssets extends Command
{
    protected $signature = 'assets:sync
        {--ver= : Belirli sürüm (boşsa DataDragon güncel sürümü)}
        {--force : Var olan dosyaları da yeniden indir}';

    protected $description = 'DataDragon küçük ikonlarını yerel aynaya (frontend/public/dd) indirir';

    private const POOL_SIZE = 20;

    /** buildData.js shardIcon ile birebir — runesReforged bunları içermez. */
    private const STAT_MOD_ICONS = [
        'StatModsAdaptiveForceIcon', 'StatModsAttackSpeedIcon', 'StatModsCDRScalingIcon',
        'StatModsMovementSpeedIcon', 'StatModsHealthScalingIcon', 'StatModsHealthPlusIcon',
        'StatModsTenacityIcon',
    ];

    public function handle(DataDragonService $ddragon): int
    {
        $cdn = config('riot.ddragon_url');
        $mirror = rtrim(config('riot.ddragon_mirror_path'), '/');
        $version = $this->option('ver') ?: $ddragon->getCurrentVersion();

        $this->info("Sürüm: {$version} → {$mirror}");

        // ---- İndirilecek dosya listesini veri JSON'larından çıkar ----
        // championFull: kare + tüm yetenek + passive ikonlarını tek istekte verir.
        $championFull = Http::timeout(30)->get("{$cdn}/cdn/{$version}/data/en_US/championFull.json")->json('data');
        $items        = Http::timeout(30)->get("{$cdn}/cdn/{$version}/data/en_US/item.json")->json('data');
        $summoners    = Http::timeout(30)->get("{$cdn}/cdn/{$version}/data/en_US/summoner.json")->json('data');
        $runes        = Http::timeout(30)->get("{$cdn}/cdn/{$version}/data/en_US/runesReforged.json")->json();

        if (! $championFull || ! $items || ! $summoners || ! $runes) {
            $this->error('DataDragon veri JSON\'ları indirilemedi.');
            return self::FAILURE;
        }

        $paths = []; // ddragon path (cdn/... ) listesi — ayna içinde aynı path'e yazılır

        foreach ($championFull as $champ) {
            $paths[] = "cdn/{$version}/img/champion/{$champ['image']['full']}";
            if (! empty($champ['passive']['image']['full'])) {
                $paths[] = "cdn/{$version}/img/passive/{$champ['passive']['image']['full']}";
            }
            foreach ($champ['spells'] ?? [] as $spell) {
                $paths[] = "cdn/{$version}/img/spell/{$spell['image']['full']}";
            }
        }
        foreach ($items as $id => $item) {
            $paths[] = "cdn/{$version}/img/item/{$id}.png";
        }
        foreach ($summoners as $spell) {
            $paths[] = "cdn/{$version}/img/spell/{$spell['image']['full']}";
        }
        foreach ($runes as $tree) {
            $paths[] = "cdn/img/{$tree['icon']}";
            foreach ($tree['slots'] as $slot) {
                foreach ($slot['runes'] as $rune) {
                    $paths[] = "cdn/img/{$rune['icon']}";
                }
            }
        }
        foreach (self::STAT_MOD_ICONS as $icon) {
            $paths[] = "cdn/img/perk-images/StatMods/{$icon}.png";
        }

        $paths = array_values(array_unique($paths));

        // ---- Var olanları ele (idempotent) ----
        $force = (bool) $this->option('force');
        $todo = $force ? $paths : array_values(array_filter(
            $paths,
            fn ($p) => ! File::exists("{$mirror}/{$p}")
        ));

        $skipped = count($paths) - count($todo);
        $this->info(count($paths) . ' ikon listelendi, ' . $skipped . ' zaten var, ' . count($todo) . ' indirilecek.');

        if (! $todo) {
            $this->info('Ayna güncel.');
            return self::SUCCESS;
        }

        // ---- POOL_SIZE'lık gruplar halinde paralel indir ----
        $ok = $fail = 0;
        $bar = $this->output->createProgressBar(count($todo));

        foreach (array_chunk($todo, self::POOL_SIZE) as $chunk) {
            $responses = Http::pool(fn ($pool) => array_map(
                fn ($p) => $pool->as($p)->timeout(20)->get("{$cdn}/{$p}"),
                $chunk
            ));

            foreach ($chunk as $p) {
                $res = $responses[$p] ?? null;
                if ($res instanceof \Illuminate\Http\Client\Response && $res->successful()) {
                    File::ensureDirectoryExists(dirname("{$mirror}/{$p}"));
                    File::put("{$mirror}/{$p}", $res->body());
                    $ok++;
                } else {
                    $fail++;
                    $this->newLine();
                    $this->warn("İndirilemedi: {$p}");
                }
                $bar->advance();
            }
        }

        $bar->finish();
        $this->newLine();

        $sizeMb = round(collect(File::allFiles($mirror))->sum(fn ($f) => $f->getSize()) / 1048576, 1);
        $this->info("Bitti: {$ok} indirildi, {$fail} hata, {$skipped} atlandı. Ayna boyutu: {$sizeMb} MB");

        return $fail > 0 ? self::FAILURE : self::SUCCESS;
    }
}
