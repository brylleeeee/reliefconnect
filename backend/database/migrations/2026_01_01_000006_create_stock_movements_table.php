<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Audit trail for every change to stock levels
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('relief_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->enum('type', ['incoming', 'adjustment', 'distribution']);
            $table->integer('quantity'); // signed: +incoming, -distribution, +/- adjustment
            $table->string('source')->nullable();  // donor / supplier for incoming stock
            $table->string('remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
