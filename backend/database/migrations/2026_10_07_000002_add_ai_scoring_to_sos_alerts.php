<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI scoring for SOS alerts. Renamed from 2026_10_05_000000 so it runs AFTER
 * 2026_10_07_000001_create_sos_alerts_table (it failed on fresh databases).
 * Each column is guarded, so databases where the old file already ran are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        $add = fn (string $column) => ! Schema::hasColumn('sos_alerts', $column);

        Schema::table('sos_alerts', function (Blueprint $table) use ($add) {
            if ($add('message')) {
                $table->text('message')->nullable();
            }
            if ($add('ai_category')) {
                $table->string('ai_category', 32)->nullable();          // flood, typhoon, fire, ...
            }
            if ($add('ai_severity')) {
                $table->unsignedTinyInteger('ai_severity')->nullable(); // 0-10 from the AI
            }
            if ($add('ai_points')) {
                $table->unsignedTinyInteger('ai_points')->default(0);   // points added to this household
            }
            if ($add('ai_reason')) {
                $table->string('ai_reason', 255)->nullable();           // short plain-English reason
            }
            if ($add('ai_source')) {
                $table->string('ai_source', 16)->nullable();            // 'ai' or 'keywords' (fallback)
            }
            if ($add('ai_scored_at')) {
                $table->timestamp('ai_scored_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        $columns = array_values(array_filter(
            ['ai_category', 'ai_severity', 'ai_points', 'ai_reason', 'ai_source', 'ai_scored_at'],
            fn ($c) => Schema::hasColumn('sos_alerts', $c),
        ));

        if ($columns) {
            Schema::table('sos_alerts', fn (Blueprint $table) => $table->dropColumn($columns));
        }
    }
};