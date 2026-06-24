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
