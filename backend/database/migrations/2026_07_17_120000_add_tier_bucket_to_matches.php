<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Maça kaynak lig damgası (EMERALD..CHALLENGER, null = bilinmiyor).
 * Worker maçı hangi ligdeki oyuncudan bulduysa onunla damgalar → ileride
 * kullanıcıya "hangi elodan istatistik" filtresi bu kolondan hesaplanır
 * (stats:rebuild tam yeniden hesap yaptığı için veri baştan damgalı birikmeli).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->string('tier_bucket', 16)->nullable()->after('game_creation')->index();
        });
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->dropIndex(['tier_bucket']);
            $table->dropColumn('tier_bucket');
        });
    }
};
