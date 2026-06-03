<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Şampiyon istatistikleri — AGGREGATE sayaçlar.
        // Maç başına satır YOK; her maç işlenip sadece bu sayaçlar artırılır.
        // Boyut: ~şampiyon × pozisyon × patch (binlerce satır), maç sayısından bağımsız.
        Schema::create('champion_stats', function (Blueprint $table) {
            $table->id();
            $table->string('patch', 16);                       // "16.11"
            $table->unsignedInteger('champion_key');           // Riot numeric id (ban eşleme)
            $table->string('champion_id', 64);                 // "Yasuo"
            $table->string('position', 16)->default('ALL');    // TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY | ALL
            $table->unsignedInteger('games')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('bans')->default(0);       // sadece ALL satırında anlamlı
            $table->timestamps();

            $table->unique(['patch', 'champion_id', 'position']);
            $table->index(['patch', 'position']);
        });

        // Patch başına toplam işlenen maç sayısı (pick/ban rate paydası).
        Schema::create('stat_patches', function (Blueprint $table) {
            $table->string('patch', 16)->primary();            // "16.11"
            $table->unsignedInteger('total_games')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('champion_stats');
        Schema::dropIfExists('stat_patches');
    }
};
