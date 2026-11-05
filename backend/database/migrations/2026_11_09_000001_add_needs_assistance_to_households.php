<?php

use App\Models\Household;
use App\Services\PriorityScorer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * needs_assistance (adviser): the household has no able-bodied adult, i.e. everyone is a senior, a PWD
 * or a minor (e.g. seniors living alone). They get extra priority points and are flagged for the priority
 * lane or home delivery. All scores are recomputed with the new rules.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('households', function (Blueprint $table) {
            $table->boolean('needs_assistance')->default(false)->after('priority_level');
            $table->index('needs_assistance');
        });

        $scorer = app(PriorityScorer::class);
        Household::with('members')->chunkById(200, function ($households) use ($scorer) {
            foreach ($households as $h) {
                $scorer->apply($h);
                $h->saveQuietly();
            }
        });
    }

    public function down(): void
    {
        Schema::table('households', function (Blueprint $table) {
            $table->dropIndex(['needs_assistance']);
            $table->dropColumn('needs_assistance');
        });
    }
};
