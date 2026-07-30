<?php

namespace App\Console\Commands;

use App\Services\RiotApi\RiotKeyStore;
use Illuminate\Console\Command;

/**
 * Riot anahtarını göster / değiştir.
 *
 *   php artisan riot:key            → durum
 *   php artisan riot:key RGAPI-xxxx → kaydet (önce Riot'a sorulur)
 *
 * NOT: portaldan otomatik alma denendi ve KALDIRILDI — Riot, otomasyon
 * tarayıcısından girişi reddediyor (2026-07-29). Anahtar portaldan elle
 * kopyalanır; bu komut ya da admin paneli sisteme yayar.
 */
class RiotKey extends Command
{
    protected $signature = 'riot:key
        {key? : Yeni RGAPI- anahtarı}
        {--force : Riot doğrulaması başarısız olsa da kaydet}';

    protected $description = 'Riot API anahtarını görüntüle veya değiştir';

    public function handle(): int
    {
        $key = $this->argument('key');

        if ($key === null) {
            return $this->showStatus();
        }

        return $this->store($key, 'manual');
    }

    /** Mevcut durumu yaz — hangi anahtar, nereden, ne kadar ömrü kaldı. */
    private function showStatus(): int
    {
        $key = RiotKeyStore::current();
        $meta = RiotKeyStore::meta();
        $left = RiotKeyStore::secondsLeft();

        if (! $key) {
            $this->error('Anahtar yok: ne DB\'de kayıt var ne de .env\'de RIOT_API_KEY.');
            return self::FAILURE;
        }

        // Anahtarın tamamı loglara/ekrana basılmaz.
        $this->line('Anahtar : ' . substr($key, 0, 11) . str_repeat('*', 12) . substr($key, -4));
        $this->line('Kaynak  : ' . ($meta['source'] ?? '.env (DB\'de kayıt yok)'));

        if ($left !== null) {
            $hours = intdiv($left, 3600);
            $mins = intdiv($left % 3600, 60);
            $this->line("Kalan   : {$hours}s {$mins}dk");
        }

        // Sebebi de yaz: "GEREKLİ" tek başına neden gerektiğini söylemiyor.
        if (! RiotKeyStore::needsRefresh()) {
            $this->line('Yenileme: gerekmiyor');
        } elseif (\Illuminate\Support\Facades\Cache::get('riot:key_invalid')) {
            $this->warn('Yenileme: GEREKLİ — Riot son isteklerde 401/403 döndü, anahtar geçersiz.');
        } else {
            $this->warn('Yenileme: GEREKLİ — süre dolmak üzere.');
        }

        return self::SUCCESS;
    }

    /** Anahtarı doğrula ve kaydet. */
    private function store(string $key, string $source, ?int $expiresAt = null): int
    {
        $key = trim($key);

        if (! RiotKeyStore::looksValid($key)) {
            $this->error('Anahtar biçimi hatalı. Beklenen: RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
            return self::FAILURE;
        }

        if (! $this->option('force')) {
            $this->line('Riot\'a soruluyor...');

            if (! RiotKeyStore::verify($key)) {
                // Kritik: doğrulanmamış anahtarı kaydetmek siteyi kırar. Eskisinde kal.
                $this->error('Riot bu anahtarı kabul etmedi. Kaydedilmedi — eski anahtar duruyor.');
                $this->line('Yine de kaydetmek için: --force');
                return self::FAILURE;
            }

            $this->info('Doğrulandı.');
        }

        RiotKeyStore::put($key, $source, $expiresAt);

        $this->info('Kaydedildi: ...' . substr($key, -4) . "  (kaynak: {$source})");
        $this->line('Deploy veya cache temizliği gerekmez — bir sonraki istekte geçerli.');

        return self::SUCCESS;
    }

}
