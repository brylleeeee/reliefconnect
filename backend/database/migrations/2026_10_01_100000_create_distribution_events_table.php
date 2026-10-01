<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Distribution events, split by who decides what:
 *  - LGU (distribution_events): which item, how much per household, each barangay's quota.
 *  - Barangay (barangay_distributions): when and where, and starting/closing its own distribution.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('distribution_events', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('relief_item_id')->constrained();
            $table->unsignedSmallInteger('quantity_per_household')->default(1);
            $table->date('distribute_by')->nullable(); // LGU deadline for barangays to schedule by
            $table->text('notes')->nullable();          // instructions from the LGU
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('status');
        });

        // One row per barangay in an event: its quota (set by the LGU)
        // and its own distribution day (set and run by the barangay).
        Schema::create('barangay_distributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('distribution_event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('barangay_id')->constrained();
            $table->unsignedInteger('quota');
            $table->dateTime('scheduled_at')->nullable();
            $table->string('venue')->nullable();
            $table->enum('status', ['unscheduled', 'scheduled', 'ongoing', 'closed'])->default('unscheduled');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['distribution_event_id', 'barangay_id'], 'event_barangay_unique'); // MySQL names max 64 chars
            $table->index('status');
        });

        // Link each claim to its event. The unique index makes a second claim by the
        // same household in the same event impossible, even with two scanners at once.
        // (MySQL allows many NULLs, so older distributions without an event are unaffected.)
        Schema::table('distributions', function (Blueprint $table) {
            $table->foreignId('distribution_event_id')->nullable()->after('id')
                  ->constrained()->nullOnDelete();
            $table->unique(['distribution_event_id', 'household_id'], 'one_claim_per_household');
        });
    }

    public function down(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->dropForeign(['distribution_event_id']);
            $table->dropUnique('one_claim_per_household');
            $table->dropColumn('distribution_event_id');
        });
        Schema::dropIfExists('barangay_distributions');
        Schema::dropIfExists('distribution_events');
    }
};
