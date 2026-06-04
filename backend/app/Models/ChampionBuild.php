<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Şampiyon build frekans sayacı.
 * patch × champion_id × position × category × item_key → games/wins.
 * category: keystone | rune_minor | shard | spell_pair | item_boots | item_core | item_full | skill_max | starter
 */
class ChampionBuild extends Model
{
    protected $fillable = [
        'patch', 'champion_id', 'position', 'category', 'item_key', 'games', 'wins',
    ];

    protected $casts = [
        'games' => 'integer',
        'wins'  => 'integer',
    ];
}
