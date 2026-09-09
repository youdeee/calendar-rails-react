<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReminderDelivery extends Model
{
    protected $fillable = [
        'user_id', 'event_id', 'occurrence_start_at', 'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'occurrence_start_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
