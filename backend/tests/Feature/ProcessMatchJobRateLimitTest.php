<?php

namespace Tests\Feature;

use App\Jobs\ProcessMatchJob;
use App\Services\BuildAggregationService;
use App\Services\RiotApi\MatchDataService;
use Illuminate\Contracts\Queue\Job as QueueJobContract;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Mockery;
use Tests\TestCase;

/**
 * Kuyruktaki maç işinin "Riot'a hiç dokunma" frenleri.
 *
 * 429 cooldown'u açıkken job'ın normal akışına devam etmesi sessiz ama pahalı bir
 * hataydı: RiotApiService::request() cooldown'u ilk satırda görüp exception fırlattığı
 * için ağ beklemesi OLMUYOR — kuyruk saniyeler içinde boşa akıyor ve her deneme
 * $tries hakkından bir tane götürüyordu. Panelde 47 gerçek 429'a karşılık 12.4k
 * "engellenen" birikmesinin sebebi buydu (kullanıcı bildirdi, 30 Tem 2026).
 *
 * İki fren de sessizce bozulabilir (biri kaldırılınca test dışında hiçbir şey
 * kırılmaz, sadece kota boşa yanar) → sözleşme burada sabitleniyor.
 */
class ProcessMatchJobRateLimitTest extends TestCase
{
    // "Cooldown geçmiş" senaryosu claim satırına (processed_matches) kadar ilerliyor.
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    /** Geri bırakma gecikmesini yakalayan sahte kuyruk işi. */
    private function fakeQueueJob(&$released): QueueJobContract
    {
        $queueJob = Mockery::mock(QueueJobContract::class);
        $queueJob->shouldReceive('release')->once()->andReturnUsing(
            function ($delay) use (&$released) { $released = $delay; }
        );

        return $queueJob;
    }

    public function test_cooldown_aktifken_riota_istek_atilmaz(): void
    {
        Cache::put('riot:rate_limit_cooldown', time() + 30, 60);

        // Tek gerçek iddia bu: cooldown açıkken Riot'a giden yol HİÇ çağrılmamalı.
        $matchData = Mockery::mock(MatchDataService::class);
        $matchData->shouldNotReceive('getMatchDetail');

        $released = null;
        $job = new ProcessMatchJob('TR1_1234567890');
        $job->setJob($this->fakeQueueJob($released));
        $job->handle($matchData, Mockery::mock(BuildAggregationService::class));

        $this->assertNotNull($released, 'cooldown açıkken iş geri bırakılmalıydı');
        // Alt sınır: kalan 1sn olsa bile job anında geri dönüp kuyruğu döndürmesin.
        $this->assertGreaterThanOrEqual(5, $released);
        $this->assertLessThanOrEqual(150, $released);
    }

    /** Süresi GEÇMİŞ cooldown fren sayılmamalı; yoksa kuyruk kalıcı olarak durur. */
    public function test_suresi_gecmis_cooldown_isi_durdurmaz(): void
    {
        Cache::put('riot:rate_limit_cooldown', time() - 5, 60);

        $matchData = Mockery::mock(MatchDataService::class);
        // Claim'den sonra ilk Riot çağrısı — buraya ULAŞMASI gerekiyor.
        $matchData->shouldReceive('getMatchDetail')->once()->andThrow(
            new \RuntimeException('devam etti')
        );

        $job = new ProcessMatchJob('TR1_1234567890');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('devam etti');
        $job->handle($matchData, Mockery::mock(BuildAggregationService::class));
    }

    public function test_anahtar_gecersizken_de_istek_atilmaz(): void
    {
        Cache::put('riot:key_invalid', true, 3600);

        $matchData = Mockery::mock(MatchDataService::class);
        $matchData->shouldNotReceive('getMatchDetail');

        $released = null;
        $job = new ProcessMatchJob('TR1_1234567890');
        $job->setJob($this->fakeQueueJob($released));
        $job->handle($matchData, Mockery::mock(BuildAggregationService::class));

        $this->assertSame(120, $released);
    }
}
