<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banned_ips', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('ip_address', 45);
            $table->string('reason', 255);
            $table->integer('failed_attempts')->default(0);
            $table->boolean('is_permanent')->default(false);
            $table->timestamp('banned_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('unbanned_at')->nullable();

            $table->index('ip_address');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banned_ips');
    }
};
