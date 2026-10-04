<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sos_alerts', function (Blueprint $table) {
            if (! Schema::hasColumn('sos_alerts', 'message')) {
                $table->text('message')->nullable();
            }
            $table->string('ai_category', 32)->nullable();       // flood, typhoon, fire, ...
            $table->unsignedTinyInteger('ai_severity')->nullable(); // 0-10 from the AI
            $table->unsignedTinyInteger('ai_points')->default(0);   // points added to this household
            $table->string('ai_reason', 255)->nullable();        // short plain-English reason
            $table->string('ai_source', 16)->nullable();         // 'ai' or 'keywords' (fallback)
            $table->timestamp('ai_scored_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sos_alerts', function (Blueprint $table) {
            $table->dropColumn(['ai_category', 'ai_severity', 'ai_points', 'ai_reason', 'ai_source', 'ai_scored_at']);
        });
    }
};
