<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rakip matchup sayaçları — AGGREGATE (maç başına satır yok).
        // Aynı maçta aynı teamPosition'daki iki rakip: A-vs-B ve B-vs-A iki satır.
        Schema::create('champion_matchups', function (Blueprint $table) {
            $table->id();
            $table->string('patch', 16);
            $table->string('champion_id', 64);       // "Aatrox"
            $table->string('position', 16);           // TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY
            $table->string('opponent_id', 64);        // karşı koridordaki şampiyon
            $table->unsignedInteger('games')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->timestamps();

            $table->unique(['patch', 'champion_id', 'position', 'opponent_id'], 'champ_matchup_unique');
            $table->index(['champion_id', 'patch']);
        });

        // Backfill bayrağı — rune_k_done/timeline_done ile aynı mantık.
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->boolean('matchup_done')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('champion_matchups');
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropColumn('matchup_done');
        });
    }
};
