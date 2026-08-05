<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
  ROL METRİKLERİ — kıyas tablosu şampiyonun İŞİNİ de ölçsün.

  Kullanıcı bildirdi (2026-08-05): "Yuumi peeler bir karakter, can/kalkan basar,
  tanklamaz; Rell tanklayan bir karakter — bunları da hesaba katmalıyız."

  Elimizdeki KDA/hasar/@15 eksenleri yalnız "kim daha çok vurdu, kim önde bitirdi"
  diyordu. Tanklamak ve iyileştirmek bu eksenlerin HİÇBİRİNDE görünmüyordu: Rell'in
  emdiği 30k hasar da, Yuumi'nin bastığı 12k kalkan da tabloya hiç girmiyordu.

  Üç yeni eksen (toplamlar; ortalama = toplam / n_role):
    - sum_taken       totalDamageTaken            → tankın işi
    - sum_heal_shield challenges.effectiveHealAndShielding (overheal HARİÇ)
                      yoksa totalHealsOnTeammates + totalDamageShieldedOnTeammates
                      → enchanter'ın işi
    - sum_cc          timeCCingOthers (saniye)    → engage/peel

  Payda neden AYRI (n_role, n_stats değil): n_stats geçmişte doldu, bu sütunlar
  boş; backfill ilerledikçe n_role n_stats'a yaklaşır. Ortak payda kullanılsaydı
  backfill sürerken ortalamalar sistematik olarak DÜŞÜK görünürdü.

  Satır sayısı sabit (~76.7k) — etki ~1 MB.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->unsignedInteger('n_role')->default(0);
            $table->unsignedBigInteger('sum_taken')->default(0);
            $table->unsignedBigInteger('sum_heal_shield')->default(0);
            $table->unsignedInteger('sum_cc')->default(0);
        });

        // Backfill bayrağı — matchup_stats_done (KDA/hasar) ile aynı desen.
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->boolean('matchup_role_done')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('champion_matchups', function (Blueprint $table) {
            $table->dropColumn(['n_role', 'sum_taken', 'sum_heal_shield', 'sum_cc']);
        });
        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropColumn('matchup_role_done');
        });
    }
};
