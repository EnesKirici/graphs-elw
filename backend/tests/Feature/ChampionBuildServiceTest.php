<?php

namespace Tests\Feature;

use App\Models\ChampionBuild;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Services\ChampionBuildService;
use App\Services\PatchService;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ChampionBuildService::getChampionBuild — build sayfası gerçek veri sözleşmesi.
 * Kritik kural: yalnız gerçekten oynanan koridorlar döner (games + pay eşiği) →
 * ör. 6 maçlık Support sekmesi görünmez. DB (sqlite) + mock DDragon/Patch.
 */
class ChampionBuildServiceTest extends TestCase
{
    use RefreshDatabase;

    private ChampionBuildService $svc;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(PatchService::class, function ($m) {
            $m->shouldReceive('keptPatches')->andReturn(['16.14', '16.13']);
        });
        $this->mock(DataDragonService::class, function ($m) {
            $m->shouldReceive('getSpellMap')->andReturn([
                4  => ['name' => 'Flash', 'image' => 'http://x/flash.png'],
                14 => ['name' => 'Ignite', 'image' => 'http://x/ignite.png'],
            ]);
        });

        $this->svc = app(ChampionBuildService::class);
    }

    private function stat(string $pos, int $games, int $wins, string $patch = '16.14'): void
    {
        ChampionStat::create([
            'patch' => $patch, 'champion_key' => 950, 'champion_id' => 'Locke',
            'position' => $pos, 'games' => $games, 'wins' => $wins, 'bans' => 0,
        ]);
    }

    private function buildRow(string $pos, string $cat, string $key, int $games, int $wins): void
    {
        ChampionBuild::create([
            'patch' => '16.14', 'champion_id' => 'Locke', 'position' => $pos,
            'category' => $cat, 'item_key' => $key, 'games' => $games, 'wins' => $wins,
        ]);
    }

    public function test_only_actually_played_positions_are_returned(): void
    {
        $this->stat('ALL', 433, 202);
        $this->stat('MIDDLE', 232, 110);
        $this->stat('JUNGLE', 145, 70);
        $this->stat('TOP', 41, 20);
        $this->stat('BOTTOM', 9, 4);   // < 10 maç → gizli
        $this->stat('UTILITY', 6, 3);  // < 10 maç ve < %5 pay → gizli (Locke Support oynanmaz)

        $out = $this->svc->getChampionBuild('Locke');

        $positions = array_column($out['positions'], 'position');
        $this->assertSame(['MIDDLE', 'JUNGLE', 'TOP'], $positions);
        $this->assertSame(433, $out['totalGames']);
        $this->assertSame(53.6, $out['positions'][0]['share']); // 232/433
    }

    public function test_patch_window_is_summed_and_categories_sorted(): void
    {
        $this->stat('ALL', 100, 50);
        $this->stat('MIDDLE', 100, 50);
        $this->stat('ALL', 20, 10, '16.13');
        $this->stat('MIDDLE', 20, 10, '16.13');

        $this->buildRow('MIDDLE', 'item_full', '3100', 80, 40);
        $this->buildRow('MIDDLE', 'item_full', '4645', 60, 35);
        $this->buildRow('MIDDLE', 'keystone', '8112', 90, 44);
        $this->buildRow('MIDDLE', 'spell_pair', '4-14', 85, 42);
        // Aynı anahtar önceki patch'te de → toplanmalı
        ChampionBuild::create([
            'patch' => '16.13', 'champion_id' => 'Locke', 'position' => 'MIDDLE',
            'category' => 'item_full', 'item_key' => '3100', 'games' => 10, 'wins' => 6,
        ]);

        $out = $this->svc->getChampionBuild('Locke');
        $mid = $out['byPosition']['MIDDLE'];

        $this->assertSame('3100', $mid['item_full'][0]['key']);
        $this->assertSame(90, $mid['item_full'][0]['games']); // 80 + 10
        $this->assertSame(51.1, $mid['item_full'][0]['winRate']); // 46/90
        $this->assertSame('8112', $mid['keystone'][0]['key']);

        // Spell pair id'leri spellMap'te çözülür
        $this->assertArrayHasKey(4, $out['spellMap']);
        $this->assertArrayHasKey(14, $out['spellMap']);
    }

    public function test_top_players_require_name_and_min_games(): void
    {
        $this->stat('ALL', 100, 50);
        $this->stat('MIDDLE', 100, 50);

        ChampionTopPlayer::create([
            'region' => 'tr1', 'champion_id' => 'Locke', 'puuid' => 'P1',
            'game_name' => 'OyuncuBir', 'tag_line' => 'TR1', 'games' => 30, 'wins' => 20,
        ]);
        ChampionTopPlayer::create([ // isimsiz → listelenmez
            'region' => 'tr1', 'champion_id' => 'Locke', 'puuid' => 'P2',
            'games' => 50, 'wins' => 30,
        ]);
        ChampionTopPlayer::create([ // 5 maç altı → listelenmez
            'region' => 'tr1', 'champion_id' => 'Locke', 'puuid' => 'P3',
            'game_name' => 'AzOynayan', 'tag_line' => 'TR1', 'games' => 3, 'wins' => 3,
        ]);

        $out = $this->svc->getChampionBuild('Locke');

        $this->assertCount(1, $out['topPlayers']);
        $this->assertSame('OyuncuBir', $out['topPlayers'][0]['name']);
        $this->assertSame(66.7, $out['topPlayers'][0]['winRate']);
    }

    public function test_no_data_returns_empty_positions(): void
    {
        $out = $this->svc->getChampionBuild('Locke');

        $this->assertSame([], $out['positions']);
        $this->assertSame(0, $out['totalGames']);
        $this->assertSame([], $out['topPlayers']);
    }
}
