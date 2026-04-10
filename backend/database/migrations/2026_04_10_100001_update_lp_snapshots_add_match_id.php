<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lp_snapshots', function (Blueprint $table) {
            $table->string('match_id', 20)->nullable()->after('queue');
            $table->index(['puuid', 'match_id']);
        });

        // Eski profil-bazlı snapshot'ları temizle (match_id olmayan)
        \App\Models\LpSnapshot::whereNull('match_id')->delete();
    }

    public function down(): void
    {
        Schema::table('lp_snapshots', function (Blueprint $table) {
            $table->dropIndex(['puuid', 'match_id']);
            $table->dropColumn('match_id');
        });
    }
};
