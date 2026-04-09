<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchRecord extends Model
{
    protected $table = 'matches';
    public $timestamps = false;
    protected $primaryKey = 'match_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'match_id', 'data', 'queue_id', 'game_duration', 'game_creation',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    public function timeline()
    {
        return $this->hasOne(MatchTimeline::class, 'match_id', 'match_id');
    }
}
