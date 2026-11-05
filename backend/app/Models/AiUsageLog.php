<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One request sent to the AI. See AiUsage. */
class AiUsageLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['model', 'purpose', 'outcome', 'http_status', 'prompt_tokens', 'output_tokens', 'total_tokens', 'duration_ms', 'error'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
