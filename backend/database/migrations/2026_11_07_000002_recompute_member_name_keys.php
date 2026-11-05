<?php

use App\Support\PersonName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Name matching now joins surname particles ("Dela Cruz" = "Delacruz"): recompute the stored keys. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('household_members')->select('id', 'full_name')->orderBy('id')->chunkById(500, function ($rows) {
            foreach ($rows as $r) {
                DB::table('household_members')->where('id', $r->id)->update(['name_key' => PersonName::key($r->full_name)]);
            }
        });
    }

    public function down(): void
    {
        // Keys are recomputed from full_name; nothing to undo
    }
};
