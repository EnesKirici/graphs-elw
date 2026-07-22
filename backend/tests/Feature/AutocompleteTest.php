<?php

namespace Tests\Feature;

use App\Models\CachedPlayer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Oyuncu autocomplete — puuid mükerrerliği (key/app değişimi) regresyon testleri.
 * 2026-07-22: aynı isim#tag'e iki puuid'li satır düşünce dropdown çift/Unranked
 * gösteriyordu; artık en DOLU satır tekil gösterilir, ranklılar önce gelir.
 */
class AutocompleteTest extends TestCase
{
    use RefreshDatabase;

    private function player(string $puuid, string $name, array $extra = []): CachedPlayer
    {
        return CachedPlayer::create(array_merge([
            'puuid'     => $puuid,
            'game_name' => $name,
            'tag_line'  => 'TR1',
        ], $extra));
    }

    public function test_ayni_isim_tag_tek_satir_ve_dolu_olani_doner(): void
    {
        // Eski app puuid'inden kalan DOLU satır + maç verisinden yeniden doğan
        // ÇIPLAK satır (daha yeni güncellenmiş) — dropdown dolu olanı göstermeli.
        $this->player('puuid-eski', 'elwyore', ['tier' => 'EMERALD', 'rank' => 'III', 'lp' => 17]);
        $this->player('puuid-yeni-ciplak', 'elwyore');
        CachedPlayer::where('puuid', 'puuid-yeni-ciplak')
            ->update(['updated_at' => now()->addMinute()]);

        $list = $this->getJson('/api/v1/summoner/autocomplete?q=elwy')
            ->assertOk()
            ->json();

        $this->assertCount(1, $list, 'Aynı isim#tag tek satır dönmeli (dedupe)');
        $this->assertSame('EMERALD', $list[0]['tier'], 'Dolu (ranklı) satır tercih edilmeli');
    }

    public function test_rankli_oyuncular_ciplak_kayitlardan_once_gelir(): void
    {
        // Çıplak satır (worker'ın maçtan tanıdığı) alfabetik/güncellik ne olursa olsun sona düşmeli.
        $this->player('p1', 'Elwind');
        $this->player('p2', 'Elwoidyy', ['tier' => 'DIAMOND', 'rank' => 'I', 'lp' => 60]);

        $list = $this->getJson('/api/v1/summoner/autocomplete?q=elw')
            ->assertOk()
            ->json();

        $this->assertSame('Elwoidyy', $list[0]['gameName']);
        $this->assertSame('Elwind', $list[1]['gameName']);
    }

    public function test_farkli_oyuncular_ayri_satir_kalir(): void
    {
        $this->player('pa', 'elwyore', ['tag_line' => 'amare', 'tier' => 'EMERALD']);
        $this->player('pb', 'elwyore', ['tag_line' => 'TR1', 'tier' => 'GOLD']);

        $list = $this->getJson('/api/v1/summoner/autocomplete?q=elwyore')
            ->assertOk()
            ->json();

        $this->assertCount(2, $list, 'Aynı isim farklı tag = farklı oyuncu, ikisi de dönmeli');
    }
}
