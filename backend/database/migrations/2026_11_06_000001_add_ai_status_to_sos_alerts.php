<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where the AI scoring of an SOS stands, now that it runs in a background job:
 *   null      = no AI (no key set, or no message): the built-in rules score is final
 *   queued    = rules score saved; waiting for the AI job to refine it
 *   done      = scored by the AI
 *   fallback  = the AI could not be reached; the rules score is kept
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sos_alerts', function (Blueprint $table) {
            $table->string('ai_status', 16)->nullable()->after('ai_source');
            $table->index('ai_status');
        });
    }

    public function down(): void
    {
        Schema::table('sos_alerts', function (Blueprint $table) {
            $table->dropIndex(['ai_status']);
            $table->dropColumn('ai_status');
        });
    }
};
