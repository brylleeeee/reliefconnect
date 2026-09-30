<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Written by Distribution Personnel (mobile app) when a QR / reference number is claimed
        Schema::create('distributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained();
            $table->foreignId('relief_item_id')->constrained();
            $table->foreignId('distributed_by')->constrained('users');
            $table->unsignedInteger('quantity')->default(1);
            $table->enum('verification_method', ['qr', 'reference_number'])->default('qr');
            $table->boolean('synced_from_offline')->default(false);
            $table->timestamp('distributed_at');
            $table->timestamps();

            $table->index('distributed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distributions');
    }
};
