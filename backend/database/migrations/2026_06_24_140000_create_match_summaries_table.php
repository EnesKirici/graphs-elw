<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Profil maç listesi için oyuncu-başına önceden hesaplanmış özet.
 * Tüm hesaplı alanlar (ELW skoru, sıralama, badge, perfLabel, takım kalite, koridor
 * rakibi vb.) summary_json içinde tutulur → liste açılışında yeniden hesaplama YOK,
 * full 10-oyuncu maçı okumaya GEREK YOK.
 *
 * matches tablosu yalnızca maç DETAYI tıklanınca dolar (geri uyumlu, ayrı kalır).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_summaries', function (Blueprint $table) {
            $table->id();
            $table->string('match_id', 32);
            $table->string('puuid', 78);
            $table->unsignedSmallInteger('queue_id')->default(0);
            $table->unsignedBigInteger('game_creation')->default(0);
            $table->boolean('win')->default(false);
            $table->json('summary_json');                       // liste gösterimi (hesaplı alanlar dahil)
            $table->json('stat_json')->nullable();              // season-stats: ham oyuncu + kompakt 10-kadro
            $table->unsignedSmallInteger('algorithm_version')->default(1); // ELW/badge algo değişince bump
            $table->timestamps();

            $table->unique(['match_id', 'puuid']);              // aynı maç+oyuncu tek satır
            $table->index(['puuid', 'game_creation']);          // profil listesi sorgusu (yeni→eski)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_summaries');
    }
};
