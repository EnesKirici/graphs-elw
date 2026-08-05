<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
  DUO @15 — "hangi eşle koridorda daha iyiyim?"

  champion_duo_stats bugüne kadar yalnız games/wins tutuyordu, yani uyumluluk
  SADECE kazanma oranından hesaplanıyordu. Kullanıcı gold/XP/öldürme/minyon
  farklarını da istedi (takım gold'u istemedi).

  DEĞERLER @15 FARKIDIR: şampiyonun 15. dakikadaki değeri EKSİ karşı koridordaki
  eşdeğerininki. İki taraf ayrı saklanır çünkü sayfa hem ADC hem support
  perspektifinden açılabiliyor (Yuumi'nin ADC eşleri / Tristana'nın support eşleri).

  ⚠ İLERİYE DÖNÜK DOLAR. Timeline SAKLANMIYOR (bkz. champion_matchups.n15 aynı
  hikâye): eski maçlardan geri doldurulamaz, ancak bugünden sonra işlenen
  maçlardan birikir. n15 = 0 olan satırda frontend "—" gösterir.

  ⚠ stats:rebuild (aggregateDuosFromMatches) eskiden tabloyu SİLİP yeniden
  kuruyordu — bu sütunları da silerdi. O komut upsert'e çevrildi: games/wins
  yeniden hesaplanır, @15 toplamlarına DOKUNULMAZ.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('champion_duo_stats', function (Blueprint $table) {
            $table->unsignedInteger('n15')->default(0);      // ortak payda

            // ADC tarafı (karşı ADC'ye göre fark)
            $table->bigInteger('adc_gd15')->default(0);
            $table->bigInteger('adc_xpd15')->default(0);
            $table->integer('adc_csd15')->default(0);
            $table->integer('adc_kd15')->default(0);

            // Support tarafı (karşı support'a göre fark)
            $table->bigInteger('sup_gd15')->default(0);
            $table->bigInteger('sup_xpd15')->default(0);
            $table->integer('sup_csd15')->default(0);
            $table->integer('sup_kd15')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('champion_duo_stats', function (Blueprint $table) {
            $table->dropColumn([
                'n15',
                'adc_gd15', 'adc_xpd15', 'adc_csd15', 'adc_kd15',
                'sup_gd15', 'sup_xpd15', 'sup_csd15', 'sup_kd15',
            ]);
        });
    }
};
