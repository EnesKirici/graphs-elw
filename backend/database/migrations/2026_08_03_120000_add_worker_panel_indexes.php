<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * /admin/worker darboğazı (ölçüm: uçtan uca 8.6 sn soğuk / 4.3 sn sıcak).
 *
 *  - crawl_players GROUP BY tier: index yoktu → EXPLAIN type=ALL + "Using temporary;
 *    Using filesort", 181K satırlık kümelenmiş index taranıyordu (~1.55 sn).
 *  - processed_matches WHERE processed_at >= bugün: index yoktu → type=ALL (~0.33 sn).
 *
 * İkisi de dar, kapsayan (covering) index'e iner. crawl_players'ın PK'sı varchar(78)
 * puuid olduğundan her secondary index bunu taşır — yine de tam tablodan çok daha küçük.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crawl_players', function (Blueprint $table) {
            $table->index('tier', 'crawl_players_tier_index');
        });

        Schema::table('processed_matches', function (Blueprint $table) {
            $table->index('processed_at', 'processed_matches_processed_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('crawl_players', function (Blueprint $table) {
            $table->dropIndex('crawl_players_tier_index');
        });

        Schema::table('processed_matches', function (Blueprint $table) {
            $table->dropIndex('processed_matches_processed_at_index');
        });
    }
};
