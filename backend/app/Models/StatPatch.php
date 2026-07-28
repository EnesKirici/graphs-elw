<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Patch başına toplam işlenen maç sayısı (pick/ban rate paydası).
 */
class StatPatch extends Model
{
    protected $primaryKey = 'patch';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['patch', 'total_games', 'first_game_at'];

    protected $casts = [
        'total_games'   => 'integer',
        'first_game_at' => 'datetime',
    ];
}
