<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support reports (panel recommendation): residents report complaints (e.g. incomplete aid)
 * and distribution staff report field problems (e.g. short on goods) to their barangay.
 * The barangay admin reviews them and marks them resolved with a note.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barangay_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('reporter_role', ['resident', 'distribution_personnel']);
            $table->foreignId('household_id')->nullable()->constrained()->nullOnDelete(); // residents only
            $table->foreignId('distribution_event_id')->nullable()->constrained()->nullOnDelete(); // the distribution it is about
            $table->string('category', 60);
            $table->text('message');
            $table->enum('status', ['open', 'resolved'])->default('open');
            $table->string('resolution_note')->nullable();  // what the barangay did about it
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['barangay_id', 'status']);
            $table->index('reported_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_reports');
    }
};