<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Authorized representatives (adviser): someone outside the household, e.g. a son caring for his senior
 * parents, who may claim relief for that household, like an authorization letter. A representative is
 * not a member: they don't count in the household's priority score. The barangay adds them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('household_representatives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name', 150);
            $table->string('name_key', 150);              // normalized, see App\Support\PersonName
            $table->string('relationship', 30);           // to the household: Son, Niece, Neighbor, ...
            $table->date('birthdate');                    // with the name, identifies the same person across households
            $table->string('contact_number', 20)->nullable();
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['name_key', 'birthdate']);
        });

        Schema::table('distributions', function (Blueprint $table) {
            $table->boolean('claimed_by_representative')->default(false)->after('verification_method');
            $table->string('claimant_name', 190)->nullable()->after('claimed_by_representative'); // "Juan Cruz (Son)"
        });
    }

    public function down(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->dropColumn(['claimed_by_representative', 'claimant_name']);
        });
        Schema::dropIfExists('household_representatives');
    }
};
