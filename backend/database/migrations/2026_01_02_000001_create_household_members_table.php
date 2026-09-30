<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('household_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->string('full_name');
            $table->string('relationship', 30); // Head, Spouse, Child, Parent...
            $table->date('birthdate');
            $table->enum('sex', ['M', 'F']);
            $table->boolean('is_pwd')->default(false);
            $table->boolean('is_pregnant')->default(false);
            $table->timestamps();

            // Speeds up the duplicate-registration check (same name + birthdate)
            $table->index(['full_name', 'birthdate']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('household_members');
    }
};
