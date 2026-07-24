<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_users', function (Blueprint $table) {
            $table->string('role', 20)->default('admin')->after('password');
        });

        // İlk hesap (kurucu) süper admin olur
        DB::table('admin_users')->orderBy('id')->limit(1)->update(['role' => 'super_admin']);
    }

    public function down(): void
    {
        Schema::table('admin_users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
