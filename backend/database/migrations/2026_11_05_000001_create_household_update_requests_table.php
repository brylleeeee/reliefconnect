<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Household update requests (panel recommendation after the alpha test): an approved household
 * asks its barangay to change its details or family members. Nothing on the household changes
 * until the barangay approves; then the proposed details replace the old ones and the priority
 * score is recomputed. The reference number and QR stay the same.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('household_update_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            // Proposed details: purok, address, is_solo_parent, members[] (same shape as registration)
            $table->json('changes');
            $table->text('reason')->nullable();          // the resident's explanation, e.g. "new baby"
            $table->string('review_note')->nullable();   // the barangay's reason when rejecting
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['household_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('household_update_requests');
    }
};
