<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChampionDuoStat extends Model
{
    protected $fillable = ['adc_champion', 'support_champion', 'games', 'wins'];
}
