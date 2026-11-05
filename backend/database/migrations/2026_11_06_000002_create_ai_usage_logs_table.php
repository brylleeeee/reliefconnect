<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per request ReliefConnect sends to the AI (Gemini). Google doesn't tell an app how much of its
 * free quota is left, so ReliefConnect counts its own requests and tokens and compares them with the daily
 * budget set in .env. This powers the AI status card for the LGU admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->string('model', 64);
            $table->string('purpose', 24)->default('sos');   // sos | test
            $table->string('outcome', 16);                    // ok | busy | invalid | error | timeout | unreadable
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->unsignedInteger('prompt_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);
            $table->unsignedInteger('duration_ms')->default(0);
            $table->string('error', 255)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
    }
};
