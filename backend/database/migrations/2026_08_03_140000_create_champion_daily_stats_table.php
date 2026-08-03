<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
  GÜNLÜK TREND SAYAÇLARI (son 30 gün: kazanma / seçim / yasaklanma eğrisi).

  champion_stats patch bazlıdır — "bu yamada durum ne" sorusunu yanıtlar ama
  "son haftalarda yükseliyor mu düşüyor mu" sorusunu yanıtlayamaz. Bu tablo günlük
  çözünürlük ekler.

  Neden ham matches'ten her seferinde hesaplamıyoruz: o tarama 32K+ maçın GZIP'ini
  açmayı gerektiriyor (stats:rebuild bu yüzden ~1s40dk sürüyor). Burada sayaç
  yaklaşımı kullanılır — maç işlenirken bir kez artırılır, sorgu anında sadece
  30 satır okunur.

  Boyut: 171 şampiyon × ~6 pozisyon × 30 gün ≈ 30K satır (~3 MB). 60 günden eskisi
  budanır (prune), çünkü grafik yalnız 30 günü gösteriyor.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('champion_daily_stats', function (Blueprint $table) {
            $table->id();
            $table->date('day');                        // maçın oynandığı gün (UTC)
            $table->string('champion_id', 64);
            $table->string('position', 16);             // 'ALL' + rol kırılımı
            $table->unsignedInteger('games')->default(0);
            $table->unsignedInteger('wins')->default(0);
            // Yasaklama şampiyon düzeyindedir (rolü yok) → yalnız 'ALL' satırında dolar.
            $table->unsignedInteger('bans')->default(0);
            $table->timestamps();

            $table->unique(['day', 'champion_id', 'position'], 'champ_daily_unique');
            $table->index(['champion_id', 'day']);
        });

        // Seçim/yasaklanma oranının PAYDASI: o gün işlenen toplam maç.
        Schema::create('stat_days', function (Blueprint $table) {
            $table->date('day')->primary();
            $table->unsignedInteger('matches')->default(0);
            $table->timestamps();
        });

        // Backfill bayrağı — diğer geriye dönük işlerle aynı desen.
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->boolean('daily_done')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('champion_daily_stats');
        Schema::dropIfExists('stat_days');
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropColumn('daily_done');
        });
    }
};
