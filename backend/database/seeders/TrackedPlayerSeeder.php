<?php

namespace Database\Seeders;

use App\Models\TrackedPlayer;
use Illuminate\Database\Seeder;

class TrackedPlayerSeeder extends Seeder
{
    /**
     * Başlangıç takip edilen 6 hesap. puuid null bırakılır; lp:capture ilk
     * çalışınca account-v1 ile çözülüp yazılır. Admin ileride satır ekleyebilir.
     */
    public function run(): void
    {
        $accounts = [
            ['game_name' => 'elw',      'tag_line' => '0000'],
            ['game_name' => 'nurayore', 'tag_line' => 'amare'],
            ['game_name' => 'elwyore',  'tag_line' => 'amare'],
            ['game_name' => '1v9 acc',  'tag_line' => 'mhm'],
            ['game_name' => 'kirai',    'tag_line' => 'mid'],
            ['game_name' => 'skylovsm', 'tag_line' => 'nuts'], // 2026-07 eklendi (6. hesap)
        ];

        foreach ($accounts as $a) {
            TrackedPlayer::firstOrCreate(
                ['game_name' => $a['game_name'], 'tag_line' => $a['tag_line'], 'region' => 'tr1'],
                ['active' => true],
            );
        }
    }
}
