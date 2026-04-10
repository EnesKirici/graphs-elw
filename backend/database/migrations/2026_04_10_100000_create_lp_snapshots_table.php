<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // LP snapshot — her profil yüklemesinde mevcut LP kaydedilir
        // Maç zamanlarıyla eşleştirilerek LP değişimi hesaplanır
        Schema::create('lp_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('puuid', 78)->index();
            $table->string('queue', 20);              // RANKED_SOLO_5x5 veya RANKED_FLEX_SR
            $table->string('tier', 20)->nullable();    // EMERALD, DIAMOND, etc.
            $table->string('rank', 5)->nullable();     // I, II, III, IV
            $table->unsignedSmallInteger('lp');         // 0-100 (veya 100+ master+)
            $table->timestamp('created_at')->useCurrent();

            // Aynı puuid+queue için son snapshot'ı hızlı bulmak
            $table->index(['puuid', 'queue', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lp_snapshots');
    }
};
