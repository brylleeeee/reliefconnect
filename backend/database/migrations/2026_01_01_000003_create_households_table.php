<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('households', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // resident account (null for walk-ins)
            $table->foreignId('barangay_id')->constrained();
            $table->string('household_head');
            $table->string('purok')->nullable();
            $table->string('address')->nullable();
            $table->string('contact_number', 20)->nullable();

            // Vulnerability counts used by the Beneficiary Report and priority scoring
            $table->unsignedSmallInteger('members_count')->default(1);
            $table->unsignedSmallInteger('seniors_count')->default(0);
            $table->unsignedSmallInteger('pwd_count')->default(0);
            $table->unsignedSmallInteger('infants_count')->default(0);
            $table->unsignedSmallInteger('pregnant_count')->default(0);

            // Static reference number issued on approval (sent via SMS)
            $table->string('reference_number')->unique()->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('rejection_reason')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->enum('registration_type', ['online', 'walk_in'])->default('online');
            $table->timestamps();

            $table->index(['status', 'barangay_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('households');
    }
};
