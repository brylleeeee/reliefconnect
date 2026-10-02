<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('households', function (Blueprint $table) {
            $table->boolean('is_solo_parent')->default(false)->after('pregnant_count');
            $table->unsignedSmallInteger('priority_score')->default(0)->after('is_solo_parent');
            $table->enum('priority_level', ['high', 'medium', 'low'])->default('low')->after('priority_score');
            $table->text('qr_secret')->nullable()->after('reference_number'); // encrypted, used for dynamic QR
            $table->foreignId('reviewed_by')->nullable()->after('approved_at')
                  ->constrained('users')->nullOnDelete();

            $table->index('priority_level');
        });
    }

    public function down(): void
    {
        Schema::table('households', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropIndex(['priority_level']);
            $table->dropColumn(['is_solo_parent', 'priority_score', 'priority_level', 'qr_secret']);
        });
    }
};
