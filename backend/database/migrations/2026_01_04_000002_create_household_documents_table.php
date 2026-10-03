<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Supporting documents uploaded from the resident app. Files live in private storage. */
    public function up(): void
    {
        Schema::create('household_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['valid_id', 'birth_certificate']);
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedInteger('size')->nullable(); // bytes
            $table->timestamps();

            $table->unique(['household_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('household_documents');
    }
};
