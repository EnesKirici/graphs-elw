<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cached_players', function (Blueprint $table) {
            $table->string('puuid', 100)->primary();
            $table->string('game_name', 50)->nullable();
            $table->string('tag_line', 10)->nullable();
            $table->string('tier', 20)->nullable();
            $table->string('rank', 5)->nullable();
            $table->string('queue', 30)->nullable();
            $table->integer('lp')->default(0);
            $table->integer('wins')->default(0);
            $table->integer('losses')->default(0);
            $table->json('top_champions')->nullable();
            $table->json('top_roles')->nullable();
            $table->integer('profile_icon_id')->nullable();
            $table->integer('summoner_level')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cached_players');
    }
};
