<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two levels of announcements:
 *  - LGU -> barangays: barangay_id is NULL; target barangays are in announcement_barangay
 *    (no rows there = all barangays).
 *  - Barangay -> its residents: barangay_id is the posting barangay. If it relays an LGU
 *    announcement, source_announcement_id points to it, so the LGU can see who relayed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->foreignId('barangay_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_announcement_id')->nullable()->after('barangay_id')
                  ->constrained('announcements')->nullOnDelete();
            $table->foreignId('distribution_event_id')->nullable()->after('source_announcement_id')
                  ->constrained()->nullOnDelete();
        });

        Schema::create('announcement_barangay', function (Blueprint $table) {
            $table->id();
            $table->foreignId('announcement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('barangay_id')->constrained()->cascadeOnDelete();
            $table->unique(['announcement_id', 'barangay_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_barangay');
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('distribution_event_id');
            $table->dropConstrainedForeignId('source_announcement_id');
            $table->dropConstrainedForeignId('barangay_id');
        });
    }
};
