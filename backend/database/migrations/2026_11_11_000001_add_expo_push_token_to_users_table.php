<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Push notifications: the Expo push token of the phone the user last logged in on.
 * Every in-app notification is also sent to this phone, even when the app is closed.
 * Cleared on logout, so a shared phone stops receiving the previous user's notifications.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('expo_push_token')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('expo_push_token');
        });
    }
};