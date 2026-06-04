<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
  Aşama 3 — Build / Ladder / OTP pipeline tabloları.
  Hepsi AGGREGATE sayaç mantığında (maç başına satır yok), DB maç sayısından bağımsız
  sabit boyutta kalır. Frontend'deki TEST verilerini (tierData/buildData/placeholder*)
  bunlar besleyecek. Worker (production key sonrası) doldurur. Bkz. WORKER_PLAN.md Aşama 3.
*/
return new class extends Migration
{
    public function up(): void
    {
        // Şampiyon build frekansları — şampiyon × pozisyon × patch için her kategori/anahtarın sayacı.
        // category: keystone | rune_minor | shard | spell_pair | item_boots | item_core | item_full | skill_max | starter
        // item_key: rün yolu / item id / spell çifti "4-7" / "Q>E>W" gibi.
        Schema::create('champion_builds', function (Blueprint $table) {
            $table->id();
            $table->string('patch', 16);
            $table->string('champion_id', 64);                 // "Lucian"
            $table->string('position', 16)->default('ALL');
            $table->string('category', 24);
            $table->string('item_key', 80);
            $table->unsignedInteger('games')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->timestamps();

            $table->unique(['patch', 'champion_id', 'position', 'category', 'item_key'], 'champ_build_unique');
            $table->index(['patch', 'champion_id', 'position', 'category']);
        });

        // Şampiyon başına en iyi oyuncular (OTP) — crawler taradıkça birikir.
        // Profil/şampiyon "dünya/TR sırası" da bu tablodan türetilir.
        Schema::create('champion_top_players', function (Blueprint $table) {
            $table->id();
            $table->string('region', 8);                       // tr1, euw1...
            $table->string('champion_id', 64);
            $table->string('puuid', 78);
            $table->string('game_name')->nullable();
            $table->string('tag_line', 16)->nullable();
            $table->unsignedInteger('games')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->string('tier', 16)->nullable();
            $table->string('rank', 8)->nullable();
            $table->unsignedInteger('lp')->default(0);
            $table->timestamps();

            $table->unique(['region', 'champion_id', 'puuid'], 'champ_otp_unique');
            $table->index(['region', 'champion_id', 'games']);
        });

        // Ladder histogramı — bölge × queue × tier × division oyuncu sayısı.
        // "Top %X" / dünya-TR sırası bu kümülatif dağılımdan hesaplanır.
        Schema::create('ladder_buckets', function (Blueprint $table) {
            $table->id();
            $table->string('region', 8);
            $table->string('queue', 24);                       // RANKED_SOLO_5x5 | RANKED_FLEX_SR
            $table->string('tier', 16);                        // IRON..CHALLENGER
            $table->string('division', 8);                     // I..IV
            $table->unsignedInteger('player_count')->default(0);
            $table->timestamps();

            $table->unique(['region', 'queue', 'tier', 'division'], 'ladder_bucket_unique');
        });

        // İşlenen maçlar — çift sayımı önlemek için (incremental işleme).
        Schema::create('processed_matches', function (Blueprint $table) {
            $table->string('match_id', 32)->primary();
            $table->string('patch', 16)->nullable();
            $table->timestamp('processed_at')->nullable();
        });

        // Crawler keşif havuzu — ladder taramasından gelen puuid'ler (öncelik + zaman imleci).
        Schema::create('crawl_players', function (Blueprint $table) {
            $table->string('puuid', 78)->primary();
            $table->string('region', 8)->default('tr1');
            $table->string('tier', 16)->nullable();
            $table->string('priority', 8)->default('normal');  // high (apex) | normal | low
            $table->timestamp('last_scanned_at')->nullable();
            $table->timestamps();

            $table->index(['region', 'priority', 'last_scanned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crawl_players');
        Schema::dropIfExists('processed_matches');
        Schema::dropIfExists('ladder_buckets');
        Schema::dropIfExists('champion_top_players');
        Schema::dropIfExists('champion_builds');
    }
};
