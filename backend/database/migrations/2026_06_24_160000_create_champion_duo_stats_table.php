<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADC + Support sinerji (duo) sayaçları. champion_stats gibi AGGREGATE — maç tek tek
 * saklanmaz, her ikili için games/wins sayılır. Ranked maçlardan (stats:rebuild ile) kurulur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('champion_duo_stats', function (Blueprint $table) {
            $table->id();
            $table->string('adc_champion', 64);
            $table->string('support_champion', 64);
            $table->unsignedInteger('games')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->timestamps();

            $table->unique(['adc_champion', 'support_champion']);
            $table->index('adc_champion');
            $table->index('support_champion');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('champion_duo_stats');
    }
};
