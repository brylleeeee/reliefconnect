<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Remembers when a barangay admin last opened the Announcements page,
 * so the sidebar can show how many LGU announcements are new since then.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('announcements_seen_at')->nullable();
        });

        // Existing accounts start with a clean badge instead of counting every old announcement
        DB::table('users')->update(['announcements_seen_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('announcements_seen_at');
        });
    }
};