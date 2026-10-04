<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * - Cash aid: a relief item of type "cash" is a fund tracked in whole pesos (unit PHP).
 *   It uses the same events, quotas and claims as goods, but stays separate on every page.
 * - Donors: a reusable list for "Source / donor", so donations can be reported per donor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('relief_items', function (Blueprint $table) {
            $table->enum('type', ['goods', 'cash'])->default('goods')->after('id');
        });

        Schema::create('donors', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->timestamps();
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreignId('donor_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
        });

        // Turn the free-text sources already logged into donors
        $sources = DB::table('stock_movements')->whereNotNull('source')->where('source', '!=', '')
            ->distinct()->pluck('source');
        foreach ($sources as $name) {
            $id = DB::table('donors')->insertGetId(['name' => trim($name), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('stock_movements')->where('source', $name)->update(['donor_id' => $id]);
        }
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('donor_id');
        });
        Schema::dropIfExists('donors');
        Schema::table('relief_items', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
