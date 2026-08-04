<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Riot puuid'leri API uygulaması (key) bazında şifreler: key/app değişince aynı
// oyuncuya YENİ puuid'li ikinci cached_players satırı açılır (2026-07-21 key
// geçişinde 6259 mükerrer oluştu). Aynı isim#tag'in yalnız en güncel satırını
// bırakır. Key/app her değiştiğinde bir kez çalıştırılmalı.
Artisan::command('players:dedupe', function () {
    // Mükerrer grupları ÖNCE belleğe al (silme sırasında chunk offset'i kaymasın).
    $groups = \App\Models\CachedPlayer::query()
        ->selectRaw('game_name, tag_line')
        ->groupBy('game_name', 'tag_line')
        ->havingRaw('COUNT(*) > 1')
        ->get();

    $deleted = 0;
    foreach ($groups as $g) {
        // En DOLU satır kalır (rank'lı > çıplak), eşitse en güncel; kopyalar silinir.
        $keep = \App\Models\CachedPlayer::where('game_name', $g->game_name)
            ->where('tag_line', $g->tag_line)
            ->orderByRaw('(tier IS NULL) asc, updated_at desc')
            ->value('puuid');
        $deleted += \App\Models\CachedPlayer::where('game_name', $g->game_name)
            ->where('tag_line', $g->tag_line)
            ->where('puuid', '!=', $keep)
            ->delete();
    }
    $this->info("Mükerrer grup: {$groups->count()} — silinen bayat kopya: {$deleted}");
})->purpose('cached_players: aynı isim#tag için eski puuid kopyalarını temizle');

// Worker zamanlaması (sunucuda cron: * * * * * php artisan schedule:run).
// Admin panelden worker_enabled ile aç/kapa; kapalıyken RIOT KEY kullanan hiçbir iş koşmaz.
$workerOn = fn () => app(\App\Services\WorkerControlService::class)->isEnabled();

// KİLİT SÜRELERİ — her withoutOverlapping'e AÇIKÇA süre verilir. Neden:
// Laravel'in varsayılanı 1440 DAKİKA (24 saat). Süreç düzgün bitmeden ölürse
// (deploy, kill, sunucu yeniden başlatma) kilit cache_locks'ta kalır ve o komut
// TAM BİR GÜN hiç koşmaz. 2026-08-04 ölçümü: queue:work bu yüzden 01.08'de 20,
// 03.08'de 15 saat ölü kaldı — 5 günün ~%40'ı boşa gitti (01.08: 1.923 maç,
// 03.08: 5.671 maç; sağlıklı gün 02.08: 14.965). Kilit tespit edilebilir bir
// belirti vermiyor: panel "ÇALIŞIYOR" yazıyor, kuyruk duruyor.
// KURAL: süre komutun GERÇEK azami çalışma süresinden uzun, ama tekrar
// aralığından makul olsun → çökme bedeli saatler değil dakikalar olur.
// Takip edilen hesapların LP'sini sık çek → maç-başına LP doğru olsun.
// Riot key kullanır → worker'a BAĞLI (kapalıyken key'i doldurmasın).
Schedule::command('lp:capture')->everyTenMinutes()->when($workerOn)->withoutOverlapping(10);
// Şampiyon meta istatistikleri — toplanan maçlardan (DB-only, Riot key'siz → hep koşar).
// SIKLIK: saatlik DEĞİL. Komut TÜM ranked maçları (32k+) GZIP açıp iki kez tarıyor
// (champion_stats + duo sinerji) ve ~1s40dk sürüyor; saatlik planda biri biterken
// diğeri başlıyordu → sunucu 7/24 tarama yapıyor, load ~4.3 ve iowait %24 (2026-08-03
// ölçümü). Saatte eklenen maç toplamın ~%1'i, yani WR ~%0.05 oynuyor: saatlik tazelik
// ölçülebilir bir fayda vermiyordu. Günde 3 kez + TR akşam yoğunluğunun (19:00-01:00)
// dışında koş → yük dörtte bire iner, veri yine gün içinde tazelenir.
// Saatler UTC (config/app.php timezone=UTC): 00:10/06:10/12:10 UTC = 03:10/09:10/15:10 TR.
// Kilit 240 dk: komut ~1s40dk sürüyor, 6 saatte bir koşuyor.
Schedule::command('stats:rebuild')->cron('10 0,6,12 * * *')->withoutOverlapping(240);

// DataDragon ikon aynası — DDragon CDN (Riot key kullanmaz → hep koşar).
Schedule::command('assets:sync')->hourly()->withoutOverlapping(50);
// Ladder havuzunu günde bir tazele (off-peak, TR gece).
Schedule::command('ladder:crawl')->dailyAt('04:15')->when($workerOn)->withoutOverlapping(120);
// Havuzdan bütçeli maç toplama (tur başına ~40 maç; user-yield ile kullanıcıya yol verir).
// Sürekli döner (everyMinute + withoutOverlapping → önceki tur bitmeden yenisi başlamaz).
// HIZ artık PANELDEN kontrol ediliyor: tur başına maç/oyuncu (match_budget/players) ve
// kullanıcıya yol verme (user_yield) → /admin/worker "Performans". Yani sıklığı elle
// değiştirmeye gerek yok; yavaşlatmak için budget'ı düşür / yield'i artır.
Schedule::command('matches:collect')->everyMinute()->when($workerOn)->withoutOverlapping(10);
// Eski maçların timeline istatistikleri (skill_order/starter/item_slot) — bütçeli backfill;
// stok bitince turlar "bekleyen yok" ile anında biter (maliyetsiz).
Schedule::command('timelines:backfill')->everyTenMinutes()->when($workerOn)->withoutOverlapping(15);
// Kuyruğu işle; boşsa anında çıkar. worker_enabled'dan BAĞIMSIZ.
//
// KUYRUK SIRASI ÖNEMLİ: profiles ÖNCE, default sonra. Laravel listedeki kuyrukları
// sırayla boşaltır, yani KULLANICI bekleten iş (soğuk profil build'i) arka plan maç
// yığınının önüne geçer. Tek kuyrukken (2026-08-04) 21.144 maç işinin arkasında 1.390
// profil işi bekliyordu — üstelik build kendini round+1 ile yeniden kuyruğa attığı
// için her tur yığının ARKASINA düşüyordu: 15 dk'lık "season:building" koruması
// dolup yeni ziyaret yeni zincir başlatıyor, tek profil için 158 mükerrer iş
// birikiyordu. Ayrı kuyrukta round'lar saniyeler içinde döner → mükerrer oluşmaz.
//
// max-time=480 (8 dk) → kilit 15 dk: sürecin gerçek ömrünün üstünde ama çökme
// bedeli 24 saat değil çeyrek saat.
Schedule::command('queue:work --queue=profiles,default --stop-when-empty --max-time=480 --tries=3')
    ->everyMinute()->withoutOverlapping(15);
