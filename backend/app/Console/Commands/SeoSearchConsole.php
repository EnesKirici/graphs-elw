<?php

namespace App\Console\Commands;

use App\Services\Seo\SearchConsoleService;
use Illuminate\Console\Command;

/**
 * Google Search Console arama performansını sunucudan sorgular.
 *
 * Amaç: SEO kararlarını tahminle değil gerçek arama verisiyle vermek — hangi
 * sorguda kaçıncı sıradayız, hangi sayfa gösterim alıp tıklama alamıyor.
 *
 *   php artisan seo:gsc --check              kurulum doğrulaması (mülke erişim var mı)
 *   php artisan seo:gsc                      son 28 günün en iyi sorguları
 *   php artisan seo:gsc --dim=page           sayfa bazında
 *   php artisan seo:gsc --dim=query --json   ham JSON (analiz için)
 */
class SeoSearchConsole extends Command
{
    protected $signature = 'seo:gsc
        {--days=28 : Kaç günlük veri}
        {--dim=query : query|page|country|device|date}
        {--limit=30 : Satır sayısı}
        {--check : Yalnız kurulumu doğrula (erişilebilen mülkleri listele)}
        {--json : Tablo yerine ham JSON bas}';

    protected $description = 'Search Console arama performansı (service account ile)';

    public function handle(SearchConsoleService $gsc): int
    {
        if (! $gsc->isConfigured()) {
            $this->error('Service account dosyası bulunamadı.');
            $this->line('Beklenen yol: ' . config('services.gsc.credentials'));
            $this->line('JSON anahtarı sunucuya koyup .env içine GSC_CREDENTIALS yazın.');
            return self::FAILURE;
        }

        try {
            if ($this->option('check')) {
                return $this->check($gsc);
            }

            // GSC verisi ~2 gün gecikmeli gelir; bitişi bugüne çekmek son iki günü
            // yapay olarak "sıfır tıklama" gösterir ve ortalamaları aşağı çeker.
            $end = now()->subDays(2);
            $start = $end->copy()->subDays((int) $this->option('days'));

            $sonuc = $gsc->searchAnalytics(
                $start->toDateString(),
                $end->toDateString(),
                [$this->option('dim')],
                (int) $this->option('limit'),
            );

            if ($this->option('json')) {
                $this->line(json_encode($sonuc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                return self::SUCCESS;
            }

            if (! $sonuc['toplam']) {
                $this->warn('Bu aralıkta veri yok. (Yeni mülklerde veri birikmesi birkaç gün sürer.)');
                return self::SUCCESS;
            }

            $this->info("Search Console — {$start->toDateString()} → {$end->toDateString()} ({$this->option('dim')})");
            $this->table(
                [ucfirst($this->option('dim')), 'Tıklama', 'Gösterim', 'CTR %', 'Sıra'],
                array_map(fn($r) => [
                    mb_strimwidth(implode(' · ', $r['anahtar']), 0, 60, '…'),
                    $r['tiklama'],
                    $r['gosterim'],
                    $r['ctr'],
                    $r['sira'],
                ], $sonuc['rows']),
            );

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }

    private function check(SearchConsoleService $gsc): int
    {
        $sites = $gsc->listSites();

        if (! $sites) {
            $this->error('Hiçbir mülke erişim yok.');
            $this->line('Service account e-postasını GSC → Ayarlar → Kullanıcılar ve izinler altında');
            $this->line('mülke eklediniz mi? (en az "Sınırlı" / okuyucu yetkisi)');
            return self::FAILURE;
        }

        $this->info('Erişilebilen mülkler:');
        foreach ($sites as $s) {
            $this->line("  {$s['siteUrl']}  ({$s['permissionLevel']})");
        }

        $hedef = config('services.gsc.site_url');
        $var = collect($sites)->contains(fn($s) => $s['siteUrl'] === $hedef);

        $this->newLine();
        $var
            ? $this->info("Hedef mülk erişilebilir: {$hedef}")
            : $this->error("Hedef mülk ({$hedef}) listede YOK — GSC_SITE_URL yanlış olabilir.");

        return $var ? self::SUCCESS : self::FAILURE;
    }
}
