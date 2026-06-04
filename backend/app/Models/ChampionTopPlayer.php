<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Şampiyon başına en iyi oyuncular (OTP). region × champion_id × puuid → games/wins.
 * Profil/şampiyon "dünya/TR sırası" da bu tablodan türetilir.
 */
class ChampionTopPlayer extends Model
{
    protected $fillable = [
        'region', 'champion_id', 'puuid', 'game_name', 'tag_line',
        'games', 'wins', 'tier', 'rank', 'lp',
    ];

    protected $casts = [
        'games' => 'integer',
        'wins'  => 'integer',
        'lp'    => 'integer',
    ];
}
