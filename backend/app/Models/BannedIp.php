<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BannedIp extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'ip_address',
        'reason',
        'failed_attempts',
        'is_permanent',
        'banned_at',
        'expires_at',
        'unbanned_at',
    ];

    protected $casts = [
        'is_permanent' => 'boolean',
        'banned_at'    => 'datetime',
        'expires_at'   => 'datetime',
        'unbanned_at'  => 'datetime',
    ];

    /**
     * IP aktif olarak banlı mı?
     */
    public static function isBanned(string $ip): bool
    {
        return static::where('ip_address', $ip)
            ->whereNull('unbanned_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->exists();
    }

    /**
     * Aktif ban kaydını getir.
     */
    public static function getActiveBan(string $ip): ?self
    {
        return static::where('ip_address', $ip)
            ->whereNull('unbanned_at')
            ->where(function ($q) {
                $q->where('is_permanent', true)
                  ->orWhere('expires_at', '>', now());
            })
            ->first();
    }

    /**
     * IP'yi banla.
     */
    public static function ban(string $ip, string $reason, int $minutes = 60, bool $permanent = false): self
    {
        // Varolan aktif ban'ı güncelle veya yeni oluştur
        $existing = static::getActiveBan($ip);

        if ($existing) {
            // Süreyi uzat ve denemesi artır
            $existing->update([
                'reason'          => $reason,
                'failed_attempts' => $existing->failed_attempts + 1,
                'is_permanent'    => $permanent,
                'expires_at'      => $permanent ? null : now()->addMinutes($minutes),
            ]);
            return $existing;
        }

        return static::create([
            'ip_address'      => $ip,
            'reason'          => $reason,
            'failed_attempts' => 1,
            'is_permanent'    => $permanent,
            'banned_at'       => now(),
            'expires_at'      => $permanent ? null : now()->addMinutes($minutes),
        ]);
    }

    /**
     * IP'nin banını kaldır.
     */
    public static function unban(string $ip): void
    {
        static::where('ip_address', $ip)
            ->whereNull('unbanned_at')
            ->update(['unbanned_at' => now()]);
    }
}
