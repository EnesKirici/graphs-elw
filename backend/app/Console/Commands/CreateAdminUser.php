<?php

namespace App\Console\Commands;

use App\Models\AdminUser;
use Illuminate\Console\Command;

class CreateAdminUser extends Command
{
    protected $signature = 'admin:create {username} {password}';

    protected $description = 'Yeni bir admin kullanıcı oluştur';

    public function handle(): int
    {
        $username = $this->argument('username');

        if (AdminUser::where('username', $username)->exists()) {
            $this->error("'{$username}' kullanıcı adı zaten mevcut.");
            return Command::FAILURE;
        }

        AdminUser::create([
            'username' => $username,
            'password' => $this->argument('password'),
        ]);

        $this->info("Admin kullanıcı '{$username}' oluşturuldu.");
        return Command::SUCCESS;
    }
}
