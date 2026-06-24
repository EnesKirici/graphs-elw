<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrackedPlayer extends Model
{
    protected $fillable = [
        'game_name', 'tag_line', 'puuid', 'region',
        'active', 'note', 'last_tracked_at', 'last_match_id',
    ];

    protected $casts = [
        'active'          => 'boolean',
        'last_tracked_at' => 'datetime',
    ];
}
