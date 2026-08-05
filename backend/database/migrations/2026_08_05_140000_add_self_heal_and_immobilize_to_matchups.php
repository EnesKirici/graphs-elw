<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
  KENDİNE İYİLEŞTİRME + SABİTLEME — kullanıcı düzeltmesi (2026-08-05).

  "Yuumi iyileştirmeyi arkadaşlarına atıyor, Swain ise kendine alıyor."
  Ölçüm doğruladı (1.200 maç örneklemi, maç başına ortalama):

      şampiyon   totalHeal   müttefiğe   kalkan   effectiveHealAndShielding
      Swain         12.817           6        0                           6
      Yuumi          9.933       8.467    8.525                      16.993
      Aatrox        16.591           0        0                           0

  Yani `challenges.effectiveHealAndShielding` YALNIZ MÜTTEFİĞE yapılanı sayıyor.
  Swain'in 12.8k'lık, Aatrox'un 16.6k'lık kendini ayakta tutması hiçbir sütuna
  yazılmıyordu ve ekranda "0.0k" görünüyordu — bu, iki şampiyonu kıyaslarken
  düpedüz yanlış bilgi.

  sum_heal_self = totalHeal − totalHealsOnTeammates  (negatife düşmez)

  SABİTLEME: `timeCCingOthers` YAVAŞLATMAYI DA sayıyor — Yuumi'nin 21 saniyesi
  var ama sabitlemesi 0 (hepsi Q yavaşlatması). Sersemletme/kök/havaya kaldırma
  ayrı bir alanda: `challenges.enemyChampionImmobilizations` (adet). İkisi farklı
  şey, tek satırda toplanamaz.

  Paydası mevcut n_role; bu yüzden komut --reset ile rol sütunlarını sıfırlayıp
  hepsini birlikte yeniden doldurur (~10 dk, Riot isteği YOK).
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->unsignedBigInteger('sum_heal_self')->default(0);
            $table->unsignedInteger('sum_immob')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->dropColumn(['sum_heal_self', 'sum_immob']);
        });
    }
};
