<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // RBAC roles from Chapter I: municipal_admin, distribution_personnel, resident
            $table->string('role')->default('resident')->after('email');
            $table->string('position')->nullable()->after('role'); // e.g. "Disaster Operations Chief"
            $table->foreignId('barangay_id')->nullable()->after('position')
                  ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('barangay_id');
            $table->dropColumn(['role', 'position']);
        });
    }
};
