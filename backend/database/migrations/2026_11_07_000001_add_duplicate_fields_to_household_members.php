<?php

use App\Support\PersonName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Stricter duplicate checks (adviser):
 *  - name_key: the normalized name ("Ma. Dela Cruz" = "Maria De La Cruz"), matched together with the birthdate
 *  - transfer_from_household_id: this member is still listed in another household; when the barangay approves,
 *    they are removed there so each person counts in one household only
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('household_members', function (Blueprint $table) {
            $table->string('name_key', 150)->nullable()->after('full_name');
            $table->foreignId('transfer_from_household_id')->nullable()->after('is_pregnant')
                ->constrained('households')->nullOnDelete();
            $table->index(['name_key', 'birthdate']);
            $table->index('birthdate');
        });

        // Fill the key for everyone already registered
        DB::table('household_members')->select('id', 'full_name')->orderBy('id')->chunkById(500, function ($rows) {
            foreach ($rows as $r) {
                DB::table('household_members')->where('id', $r->id)->update(['name_key' => PersonName::key($r->full_name)]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('household_members', function (Blueprint $table) {
            $table->dropIndex(['name_key', 'birthdate']);
            $table->dropIndex(['birthdate']);
            $table->dropConstrainedForeignId('transfer_from_household_id');
            $table->dropColumn('name_key');
        });
    }
};
