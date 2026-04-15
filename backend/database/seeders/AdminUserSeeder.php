<?php

namespace Database\Seeders;

use App\Models\AdminUser;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        AdminUser::updateOrCreate(
            ['username' => 'admin'],
            ['password' => 'admin123']
        );

        $this->command->info('Admin kullanıcı: admin / admin123 (production\'da değiştir)');
    }
}
