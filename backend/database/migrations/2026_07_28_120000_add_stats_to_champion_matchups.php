<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
  champion_matchups'a detaylı head-to-head metrikleri (toplamlar → ortalama = toplam/sayaç).
  - KDA/hasar/KP: maç detayından (stored maçlardan backfill'lenir, Riot'suz). Payda n_stats
    (WR'nin games'inden AYRI: bazı işlenmiş maçlar prune edildi → ham detay yok).
  - @15 koridor farkı (gold/cs/xp): timeline'dan; işaretli (negatif olabilir). Payda n15,
    ileriye dönük processTimeline doldurur (timeline saklanmıyor, eski maç re-fetch edilmez).
  Tümü agregat — satır sayısı sabit (~22.5k), etki ~0.8 MB.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            // KDA / hasar / KP — maç detayı örneklemi
            $table->unsignedInteger('n_stats')->default(0);
            $table->unsignedInteger('sum_kills')->default(0);
            $table->unsignedInteger('sum_deaths')->default(0);
            $table->unsignedInteger('sum_assists')->default(0);
            $table->unsignedInteger('sum_kp')->default(0);        // KP% toplamı (0-100/maç)
            $table->unsignedBigInteger('sum_dmg')->default(0);    // şampiyonlara hasar toplamı
            // @15 koridor avantajı — timeline örneklemi (Faz B doldurur)
            $table->unsignedInteger('n15')->default(0);
            $table->bigInteger('sum_gd15')->default(0);           // gold farkı (işaretli)
            $table->integer('sum_csd15')->default(0);             // cs farkı (işaretli)
            $table->bigInteger('sum_xpd15')->default(0);          // xp farkı (işaretli)
        });

        // KDA/hasar backfill bayrağı (matchup_done games/wins içindir; bu KDA/hasar içindir).
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->boolean('matchup_stats_done')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->dropColumn(['n_stats', 'sum_kills', 'sum_deaths', 'sum_assists', 'sum_kp', 'sum_dmg', 'n15', 'sum_gd15', 'sum_csd15', 'sum_xpd15']);
        });
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropColumn('matchup_stats_done');
        });
    }
};
