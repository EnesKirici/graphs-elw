<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Patch'in GERÇEKTE ne zaman başladığı — verinin kendisinden gözlemlenir.
     *
     * Eskiden patch başlangıç tarihleri config'e elle yazılıyordu
     * (elwgraphs.meta.patch_starts) ve her yamada bir satır eklemek gerekiyordu.
     * Bu adım 16.15'te atlandı → keepSince() bir sonraki yamada null'a düşüp
     * matches:prune'u sessizce devre dışı bırakacaktı. Ayrıca DataDragon sürümü
     * oyun yamasından ÖNCE düştüğü için elle yazılan tarih kolayca 1 gün kayıyor.
     *
     * stats:rebuild her turda maçları zaten patch'e göre dolaşıyor; aynı turda
     * patch başına EN ESKİ gameCreation'ı da yazıyor. Böylece başlangıç, bölgenin
     * (TR) yamayı gerçekten aldığı ana oturur ve elle bakım gerekmez.
     */
    public function up(): void
    {
        Schema::table('stat_patches', function (Blueprint $table) {
            $table->timestamp('first_game_at')->nullable()->after('total_games');
        });
    }

    public function down(): void
    {
        Schema::table('stat_patches', function (Blueprint $table) {
            $table->dropColumn('first_game_at');
        });
    }
};
