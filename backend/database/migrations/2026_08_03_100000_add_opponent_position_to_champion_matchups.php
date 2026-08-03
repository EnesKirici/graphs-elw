<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
  ÇAPRAZ KORİDOR EŞLEŞMESİ (bot lane 2v2).

  champion_matchups şimdiye kadar YALNIZ aynı pozisyonu eşleştiriyordu (ADC↔ADC).
  Oysa alt koridor 2v2 oynanır: ADC için karşı SUPPORT da doğrudan bir rakiptir
  (bir Blitzcrank/Thresh eşleşmesi, karşı ADC kadar belirleyici olabilir).

  opponent_position rakibin OYNADIĞI pozisyonu tutar:
    - aynı koridor düellosu  → opponent_position = position   (mevcut tüm satırlar)
    - çapraz (yeni)          → ör. champion=Kaisa/BOTTOM, opponent=Thresh/UTILITY

  Unique index'e dahil edilir, yoksa "Kaisa vs Thresh" satırı hangi ilişkiyi
  temsil ettiği belirsiz kalır ve iki farklı ilişki aynı satıra toplanır.

  Maliyet: çapraz satırlar yalnız BOTTOM↔UTILITY için üretilir (~40 ADC × ~45 SUP
  × 2 yön × tutulan patch) ≈ birkaç bin satır, ~2 MB. Ekstra Riot isteği YOK —
  veri zaten işlenen maçın içinde.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->string('opponent_position', 16)->default('')->after('opponent_id');
        });

        // Şimdiye kadar yazılmış her satır aynı-koridor düellosudur.
        DB::table('champion_matchups')->update(['opponent_position' => DB::raw('position')]);

        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->dropUnique('champ_matchup_unique');
            $table->unique(
                ['patch', 'champion_id', 'position', 'opponent_id', 'opponent_position'],
                'champ_matchup_unique'
            );
        });

        // Çapraz satırların geriye dönük üretimi için bayrak (matchup_done ile aynı mantık).
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->boolean('cross_done')->default(false)->index();
        });
    }

    public function down(): void
    {
        // Çapraz satırlar şemadan çıkarılıyorsa veri olarak da anlamsızlaşır.
        DB::table('champion_matchups')->whereColumn('opponent_position', '!=', 'position')->delete();

        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->dropUnique('champ_matchup_unique');
            $table->unique(['patch', 'champion_id', 'position', 'opponent_id'], 'champ_matchup_unique');
            $table->dropColumn('opponent_position');
        });

        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropColumn('cross_done');
        });
    }
};
