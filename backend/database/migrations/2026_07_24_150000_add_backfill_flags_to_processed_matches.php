<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('processed_matches', function (Blueprint $table) {
            // rune_k_done: keystone-koşullu rün sayaçları (rune_minor_k/shard_k) bu maç
            // için işlendi mi? Eski maçlar builds:backfill-runes ile 0→1 taşınır.
            $table->boolean('rune_k_done')->default(false)->index();
            // timeline_done: timeline'a bağlı sayaçlar (skill_order/starter/item_slotN)
            // işlendi mi? timelines:backfill Riot'tan çekip 0→1 yapar.
            $table->boolean('timeline_done')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropColumn(['rune_k_done', 'timeline_done']);
        });
    }
};
