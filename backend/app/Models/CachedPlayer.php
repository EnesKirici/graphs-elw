<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CachedPlayer extends Model
{
    protected $primaryKey = 'puuid';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'puuid', 'game_name', 'tag_line', 'tier', 'rank', 'queue',
        'lp', 'wins', 'losses', 'top_champions', 'top_roles',
        'profile_icon_id', 'summoner_level',
    ];

    protected $casts = [
        'top_champions' => 'array',
        'top_roles'     => 'array',
    ];
}
