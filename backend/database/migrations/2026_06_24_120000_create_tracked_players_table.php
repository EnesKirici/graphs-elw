<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sürekli takip edilen hesaplar (worker → lp:capture). crawl_players'tan ayrı:
 * burada riot-id (game_name/tag_line) tutulur, az sayıda, admin yönetir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracked_players', function (Blueprint $table) {
            $table->id();
            $table->string('game_name', 64);
            $table->string('tag_line', 16);
            $table->string('puuid', 78)->nullable()->unique(); // ilk çözümde dolar
            $table->string('region', 8)->default('tr1');
            $table->boolean('active')->default(true);
            $table->string('note')->nullable();
            $table->timestamp('last_tracked_at')->nullable();
            $table->string('last_match_id', 32)->nullable();   // incremental imleç
            $table->timestamps();

            $table->unique(['game_name', 'tag_line', 'region']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_players');
    }
};
