<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * JSON'u diskte gzip'li BLOB olarak saklar (~%80 yer kazancı).
 *
 * Kolon MEDIUMBLOB olmalı. Okurken gzip imzasını (\x1f\x8b) tanır; imza yoksa
 * düz JSON kabul eder → henüz sıkıştırılmamış eski satırlarla geriye uyumlu
 * (matches:compress backfill'i tamamlanana kadar iki biçim yan yana yaşayabilir).
 */
class GzipJson implements CastsAttributes
{
    private const GZIP_MAGIC = "\x1f\x8b";

    /** Sıkıştırma seviyesi: 6 = boyut/CPU dengesi (9'un kazancı ~%1, CPU'su 2x). */
    private const LEVEL = 6;

    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        if ($value === null) {
            return null;
        }

        if (str_starts_with($value, self::GZIP_MAGIC)) {
            $value = gzdecode($value);
        }

        return json_decode($value, true);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return gzencode(json_encode($value, JSON_UNESCAPED_UNICODE), self::LEVEL);
    }
}
