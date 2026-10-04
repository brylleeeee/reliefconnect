<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who can receive in an event: all households, or only households with a senior,
 * PWD, infant or pregnant member (given per qualifying member), or solo-parent
 * households (given per household). See DistributionEvent::ELIGIBILITY.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distribution_events', function (Blueprint $table) {
            $table->string('eligibility', 20)->default('all')->after('quantity_per_household');
        });
    }

    public function down(): void
    {
        Schema::table('distribution_events', function (Blueprint $table) {
            $table->dropColumn('eligibility');
        });
    }
};
