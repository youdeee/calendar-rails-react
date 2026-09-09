<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Event extends Model
{
    protected $fillable = [
        'user_id', 'title', 'description', 'start_at', 'end_at', 'start_on', 'end_on',
        'all_day', 'reminder_minutes', 'recurrence_rule',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'start_on' => 'date',
            'end_on' => 'date',
            'all_day' => 'boolean',
            'reminder_minutes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recurring(): bool
    {
        return filled($this->recurrence_rule);
    }

    public function recurrenceParams(): ?array
    {
        if (! $this->recurring()) {
            return null;
        }

        $decoded = json_decode($this->recurrence_rule, true);
        if (! is_array($decoded)) {
            return null;
        }

        return $decoded;
    }
}
