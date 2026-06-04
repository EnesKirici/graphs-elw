<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Ladder histogramı — region × queue × tier × division → player_count.
 * "Top %X" / dünya-TR sırası bu kümülatif dağılımdan hesaplanır.
 */
class LadderBucket extends Model
{
    protected $fillable = [
        'region', 'queue', 'tier', 'division', 'player_count',
    ];

    protected $casts = [
        'player_count' => 'integer',
    ];
}
