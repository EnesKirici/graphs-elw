<?php

namespace Tests\Feature;

use App\Models\StatPatch;
use App\Services\PatchService;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Patch başlangıç tarihleri VERİDEN gözlemlenir (stat_patches.first_game_at),
 * config elwgraphs.meta.patch_starts yalnızca tohum/yedektir.
 *
 * Neden test var: 16.15'te config'e satır eklenmesi atlandı ve keepSince() bir
 * sonraki yamada null'a düşüp matches:prune'u sessizce devre dışı bırakacaktı.
 * Ayrıca ddragon sürümü oyun yamasından önce düştüğü için elle yazılan tarih
 * kolayca 1 gün kayıyor.
 */
class PatchStartsTest extends TestCase
{
    use RefreshDatabase;

    private function service(array $recentPatches): PatchService
    {
        $this->mock(DataDragonService::class, function ($m) use ($recentPatches) {
            $m->shouldReceive('getRecentPatches')->andReturn($recentPatches);
        });

        return app(PatchService::class);
    }

    /** Gözlemlenen ilk maç, config'teki elle yazılmış tarihi ezer. */
    public function test_observed_first_game_overrides_config_date(): void
    {
        config(['elwgraphs.meta.patch_starts' => ['16.14' => '2026-07-14']]);
        // Gerçekte ilk 16.14 maçı 16 Temmuz'da oynanmış (config 1 gün+ kaymış).
        StatPatch::create([
            'patch'         => '16.14',
            'total_games'   => 10,
            'first_game_at' => '2026-07-16 08:30:00',
        ]);

        $svc = $this->service(['16.14', '16.13']);

        // 15 Temmuz'daki bir maç artık 16.14'e DEĞİL, öncesine düşer (bilinmiyor → null).
        $this->assertNull($svc->patchForDate(strtotime('2026-07-15 12:00:00') * 1000));
        // 16 Temmuz'daki maç 16.14.
        $this->assertSame('16.14', $svc->patchForDate(strtotime('2026-07-16 12:00:00') * 1000));
    }

    /** Gözlemlenen tarih günün başına yuvarlanır: ilk maçtan ÖNCEKİ aynı gün maçları da o patch. */
    public function test_observed_start_is_rounded_to_start_of_day(): void
    {
        config(['elwgraphs.meta.patch_starts' => []]);
        StatPatch::create([
            'patch'         => '16.15',
            'total_games'   => 5,
            'first_game_at' => '2026-07-29 14:00:00',
        ]);

        $svc = $this->service(['16.15', '16.14']);

        $this->assertSame('16.15', $svc->patchForDate(strtotime('2026-07-29 06:00:00') * 1000));
    }

    /** config'te SATIR OLMASA BİLE prune eşiği hesaplanır (eski elle-bakım tuzağı). */
    public function test_keep_since_works_without_config_entry(): void
    {
        config(['elwgraphs.meta.patch_starts' => []]); // kimse satır eklemedi
        StatPatch::create([
            'patch'         => '16.16',
            'total_games'   => 3,
            'first_game_at' => '2026-08-11 10:00:00',
        ]);
        StatPatch::create([
            'patch'         => '16.15',
            'total_games'   => 40,
            'first_game_at' => '2026-07-29 14:00:00',
        ]);

        $svc = $this->service(['16.16', '16.15']); // tutulan en eski patch: 16.15

        $keepSince = $svc->keepSince();
        $this->assertNotNull($keepSince, 'keepSince null dönerse matches:prune sessizce hiçbir şey yapmaz');
        $this->assertSame('2026-07-29', $keepSince->toDateString());
    }

    /** Gözlem yoksa config'e düşer (tarihsel patch'ler + henüz maç toplanmamış yeni patch). */
    public function test_falls_back_to_config_when_no_observed_data(): void
    {
        config(['elwgraphs.meta.patch_starts' => ['16.15' => '2026-07-29', '16.14' => '2026-07-14']]);

        $svc = $this->service(['16.15', '16.14']);

        $this->assertSame('16.15', $svc->patchForDate(strtotime('2026-07-30 12:00:00') * 1000));
        $this->assertSame('16.14', $svc->patchForDate(strtotime('2026-07-20 12:00:00') * 1000));
        $this->assertSame('2026-07-14', $svc->keepSince()->toDateString());
    }

    /** gameVersion varsa tarih hiç kullanılmaz — asıl kaynak odur. */
    public function test_game_version_wins_over_dates(): void
    {
        config(['elwgraphs.meta.patch_starts' => ['16.14' => '2026-07-14']]);
        $svc = $this->service(['16.15', '16.14']);

        $this->assertSame('16.15', $svc->patchForMatch([
            'gameVersion'  => '16.15.1',
            'gameCreation' => strtotime('2026-07-20 12:00:00') * 1000, // tarih 16.14'ü gösterse de
        ]));
    }
}
