<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Not everything the LGU receives is a donation, so "donors" become "sources" with a type:
 *   donation              - private donors, NGOs, churches, companies
 *   lgu_fund              - the municipality's own budget (e.g. Municipal Treasury)
 *   government_allocation - DSWD, the provincial government, OCD
 * Existing records are kept; they start as "donation" and can be changed.
 * The old free-text stock_movements.source column is dropped: its values were already
 * turned into source records by the 2026_10_04 migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['donor_id']);
        });

        Schema::rename('donors', 'sources');

        Schema::table('sources', function (Blueprint $table) {
            $table->enum('type', ['donation', 'lgu_fund', 'government_allocation'])->default('donation')->after('name');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->renameColumn('donor_id', 'source_id');
            $table->dropColumn('source');
        });
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreign('source_id')->references('id')->on('sources')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['source_id']);
            $table->renameColumn('source_id', 'donor_id');
            $table->string('source')->nullable();
        });
        Schema::table('sources', function (Blueprint $table) {
            $table->dropColumn('type');
        });
        Schema::rename('sources', 'donors');
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreign('donor_id')->references('id')->on('donors')->nullOnDelete();
        });
    }
};
