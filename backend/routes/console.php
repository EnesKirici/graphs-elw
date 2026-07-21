<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

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
