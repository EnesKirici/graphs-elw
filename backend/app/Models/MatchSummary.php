<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchSummary extends Model
{
    protected $fillable = [
        'match_id', 'puuid', 'queue_id', 'game_creation',
        'win', 'summary_json', 'stat_json', 'algorithm_version',
    ];

    protected $casts = [
        'win'          => 'boolean',
        'summary_json' => 'array',
        'stat_json'    => 'array',
    ];
}
