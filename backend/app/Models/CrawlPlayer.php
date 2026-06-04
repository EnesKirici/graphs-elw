<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Crawler keşif havuzu — ladder taramasından gelen puuid'ler.
 * priority: high (apex) | normal | low. last_scanned_at ile sırayla taranır.
 */
class CrawlPlayer extends Model
{
    protected $primaryKey = 'puuid';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'puuid', 'region', 'tier', 'priority', 'last_scanned_at',
    ];

    protected $casts = [
        'last_scanned_at' => 'datetime',
    ];
}
