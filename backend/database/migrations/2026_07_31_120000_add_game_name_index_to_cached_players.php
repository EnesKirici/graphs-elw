<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Autocomplete darboğazı: `WHERE game_name LIKE 'q%' ORDER BY updated_at DESC`.
 * cached_players 165K satıra ulaştı (crawler) ve game_name'de index YOKTU →
 * her aramada tam tablo taraması + filesort (~5.5s ölçüldü). Prefix LIKE ('q%')
 * bu index'i aralık taramasıyla kullanabilir → eşleşen az satıra iner.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cached_players', function (Blueprint $table) {
            $table->index('game_name', 'cached_players_game_name_index');
        });
    }

    public function down(): void
    {
        Schema::table('cached_players', function (Blueprint $table) {
            $table->dropIndex('cached_players_game_name_index');
        });
    }
};
