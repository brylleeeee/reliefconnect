<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Residents log in with their mobile number and distribution staff with a username,
     * so email becomes optional (admins keep using email).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('phone', 11)->nullable()->unique()->after('email');
            $table->string('username', 50)->nullable()->unique()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['phone']);
            $table->dropUnique(['username']);
            $table->dropColumn(['phone', 'username']);
            $table->string('email')->nullable(false)->change();
        });
    }
};
