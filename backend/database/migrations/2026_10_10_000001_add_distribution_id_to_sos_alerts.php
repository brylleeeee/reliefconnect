<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The claim that served an SOS. Set automatically when a household with an active SOS claims its relief
 * goods, so the SOS closes by itself and the barangay's place in the ranking moves on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sos_alerts', function (Blueprint $table) {
            $table->foreignId('distribution_id')->nullable()->after('served_at')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sos_alerts', fn (Blueprint $table) => $table->dropConstrainedForeignId('distribution_id'));
    }
};
