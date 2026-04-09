<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchTimeline extends Model
{
    public $timestamps = false;
    protected $primaryKey = 'match_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'match_id', 'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];
}
