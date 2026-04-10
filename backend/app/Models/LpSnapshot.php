<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LpSnapshot extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'puuid', 'queue', 'tier', 'rank', 'lp',
    ];
}
