<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Şampiyon istatistik sayacı (patch + şampiyon + pozisyon başına).
 * position = 'ALL' satırı şampiyonun genel toplamını ve ban sayısını tutar.
 */
class ChampionStat extends Model
{
    protected $fillable = [
        'patch', 'champion_key', 'champion_id', 'position', 'games', 'wins', 'bans',
    ];

    protected $casts = [
        'champion_key' => 'integer',
        'games'        => 'integer',
        'wins'         => 'integer',
        'bans'         => 'integer',
    ];
}
