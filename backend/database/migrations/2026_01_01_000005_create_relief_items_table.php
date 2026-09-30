<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('relief_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');                         // "PH Red Cross Family Food Pack"
            $table->string('contents')->nullable();         // "Rice, Canned Goods, Coffee"
            $table->string('unit')->default('Packs');       // Packs, Kits, Carboys, Bags, Sets
            $table->unsignedInteger('quantity_in_stock')->default(0);
            $table->unsignedInteger('distributed_to_date')->default(0);
            $table->unsignedInteger('reorder_level')->default(50); // drives "Critical Stock Alerts"
            $table->date('expiry_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('relief_items');
    }
};
