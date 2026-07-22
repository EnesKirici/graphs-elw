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

// Worker zamanlaması (sunucuda cron: * * * * * php artisan schedule:run)
// Takip edilen hesapların LP'sini sık çek → maç-başına LP doğru olsun.
Schedule::command('lp:capture')->everyTenMinutes()->withoutOverlapping();
// Şampiyon meta istatistiklerini topladığımız maçlardan tazele.
Schedule::command('stats:rebuild')->hourly()->withoutOverlapping();

// DataDragon ikon aynası — idempotent; yeni patch çıktığında ayna kendiliğinden dolar.
Schedule::command('assets:sync')->hourly()->withoutOverlapping();

// Meta worker (admin panelden worker_enabled ile aç/kapa; kapalıyken hiçbiri koşmaz).
$workerOn = fn () => app(\App\Services\WorkerControlService::class)->isEnabled();
// Ladder havuzunu günde bir tazele (off-peak, TR gece).
Schedule::command('ladder:crawl')->dailyAt('04:15')->when($workerOn)->withoutOverlapping();
// Havuzdan bütçeli maç toplama (tur başına ~40 maç; user-yield ile kullanıcıya yol verir).
Schedule::command('matches:collect')->everyTenMinutes()->when($workerOn)->withoutOverlapping();
// Kuyruktaki ProcessMatchJob'ları işle; kuyruk boşsa anında çıkar (worker kapansa da kuyruğu boşaltır).
Schedule::command('queue:work --stop-when-empty --max-time=480 --tries=3')
    ->everyTenMinutes()->withoutOverlapping();
