<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Rakip matchup sayaçları: patch × şampiyon × pozisyon × rakip → games/wins.
 * Aynı maçtaki karşı koridor eşleşmesinden türetilir (BuildAggregationService).
 */
class ChampionMatchup extends Model
{
    protected $fillable = [
        'patch', 'champion_id', 'position', 'opponent_id', 'games', 'wins',
    ];

    protected $casts = [
        'games' => 'integer',
        'wins'  => 'integer',
    ];
}
