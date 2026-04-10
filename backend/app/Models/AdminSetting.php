<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class AdminSetting extends Model
{
    public $timestamps = false;

    protected $fillable = ['key', 'value', 'updated_at'];

    protected $casts = [
        'value'      => 'array',
        'updated_at' => 'datetime',
    ];

    /**
     * Ayar değerini cache ile oku.
     */
    public static function getValue(string $key, $default = null)
    {
        return Cache::rememberForever("admin_setting:{$key}", function () use ($key, $default) {
            $setting = static::where('key', $key)->first();
            return $setting ? $setting->value : $default;
        });
    }

    /**
     * Ayar değerini güncelle ve cache'i temizle.
     */
    public static function setValue(string $key, $value): void
    {
        static::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'updated_at' => now()]
        );

        Cache::forget("admin_setting:{$key}");
    }
}
