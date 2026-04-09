<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Maç detayları — Riot API'den çekilen ham veri
        // Maçlar asla değişmez, bir kere yazılır sonsuza kadar kalır
        Schema::create('matches', function (Blueprint $table) {
            $table->string('match_id', 20)->primary(); // TR1_1234567890
            $table->json('data');                       // Riot API response (info kısmı)
            $table->unsignedSmallInteger('queue_id')->index();
            $table->unsignedInteger('game_duration');
            $table->bigInteger('game_creation')->index(); // timestamp ms
            $table->timestamp('created_at')->useCurrent();
        });

        // Maç timeline verileri — dakika dakika gold/xp/event
        Schema::create('match_timelines', function (Blueprint $table) {
            $table->string('match_id', 20)->primary();
            $table->json('data');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('match_id')->references('match_id')->on('matches')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_timelines');
        Schema::dropIfExists('matches');
    }
};
