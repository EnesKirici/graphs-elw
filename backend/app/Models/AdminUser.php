<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['username', 'password', 'role'])]
#[Hidden(['password'])]
class AdminUser extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'admin_users';

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }
}
