<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row = one resident pressed SOS = that household needs relief goods.
        Schema::create('sos_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('household_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('barangay_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('people_count')->default(1); // household size when the SOS was sent
            $table->decimal('latitude', 10, 7)->nullable();           // for the SOS Live Map later
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('status')->default('pending');             // pending, served, cancelled
            $table->timestamp('served_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'barangay_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sos_alerts');
    }
};
