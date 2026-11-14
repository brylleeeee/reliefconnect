<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notification Preferences (resident app → Account): which notifications pop up on the phone.
 * Stored as the categories the user turned OFF, e.g. {"enabled": true, "muted": ["announcements"]}.
 * Null = everything on (the default). The in-app bell list always gets every notification.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('notification_preferences')->nullable()->after('expo_push_token');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('notification_preferences');
        });
    }
};
