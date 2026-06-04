<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * İşlenen maçlar — çift sayımı önlemek için (incremental işleme).
 * match_id primary key; timestamps yok (sadece processed_at).
 */
class ProcessedMatch extends Model
{
    protected $primaryKey = 'match_id';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'match_id', 'patch', 'processed_at',
    ];

    protected $casts = [
        'processed_at' => 'datetime',
    ];
}
