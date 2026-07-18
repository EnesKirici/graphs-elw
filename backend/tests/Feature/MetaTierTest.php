<?php

namespace Tests\Feature;

use App\Services\MetaService;
use ReflectionClass;
use Tests\TestCase;

/**
 * MetaService kompozit tier mantığı (config/elwgraphs.php ağırlık & eşikleriyle).
 * tierFromScore + compositeTierScore private → reflection ile çağrılır (uygulama
 * boot edilir ki config() çalışsın; DB gerekmez). Tier list doğruluğu kritik.
 */
class MetaTierTest extends TestCase
{
    private MetaService $svc;
    private ReflectionClass $ref;

    protected function setUp(): void
    {
        parent::setUp();
        // Constructor'ı (DataDragon/Riot bağımlılıkları) atla — test edilen metotlar
        // yalnızca config() kullanıyor, örnek bağımlılığı yok.
        $this->ref = new ReflectionClass(MetaService::class);
        $this->svc = $this->ref->newInstanceWithoutConstructor();
    }

    private function invokePrivate(string $method, ...$args): mixed
    {
        $m = $this->ref->getMethod($method);
        $m->setAccessible(true);

        return $m->invoke($this->svc, ...$args);
    }

    public function test_tier_from_score_maps_thresholds(): void
    {
        $this->assertSame('S+', $this->invokePrivate('tierFromScore', 0.90));
        $this->assertSame('S+', $this->invokePrivate('tierFromScore', 0.70)); // tam sınır → S+
        $this->assertSame('S',  $this->invokePrivate('tierFromScore', 0.65));
        $this->assertSame('A',  $this->invokePrivate('tierFromScore', 0.55));
        $this->assertSame('B',  $this->invokePrivate('tierFromScore', 0.40));
        $this->assertSame('C',  $this->invokePrivate('tierFromScore', 0.25));
        $this->assertSame('D',  $this->invokePrivate('tierFromScore', 0.10));
    }

    public function test_composite_score_is_monotonic_in_win_rate(): void
    {
        // Diğer her şey sabit; daha yüksek Wilson WR → daha yüksek kompozit skor.
        $low  = $this->invokePrivate('compositeTierScore', 0.45, 5.0, 10.0, 50);
        $high = $this->invokePrivate('compositeTierScore', 0.57, 5.0, 10.0, 50);

        $this->assertGreaterThan($low, $high);
    }

    public function test_composite_score_bounded_0_1(): void
    {
        $min = $this->invokePrivate('compositeTierScore', 0.0, 0.0, 0.0, 0);
        $max = $this->invokePrivate('compositeTierScore', 1.0, 999.0, 999.0, 100000);

        $this->assertGreaterThanOrEqual(0.0, $min);
        $this->assertLessThanOrEqual(1.0, $max);
        $this->assertEqualsWithDelta(1.0, $max, 1e-9); // tüm bileşenler doygun → 1.0
    }

    public function test_higher_win_rate_never_yields_worse_tier(): void
    {
        $tierLow  = $this->invokePrivate('tierFromScore', $this->invokePrivate('compositeTierScore', 0.46, 5.0, 5.0, 100));
        $tierHigh = $this->invokePrivate('tierFromScore', $this->invokePrivate('compositeTierScore', 0.56, 5.0, 5.0, 100));

        $order = ['D' => 0, 'C' => 1, 'B' => 2, 'A' => 3, 'S' => 4, 'S+' => 5];
        $this->assertGreaterThanOrEqual($order[$tierLow], $order[$tierHigh]);
    }
}
