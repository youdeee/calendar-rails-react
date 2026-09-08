<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class RefreshToken extends Model
{
    public const TTL_DAYS = 30;

    protected $fillable = ['user_id', 'token_digest', 'expires_at', 'revoked_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function issue(User $user): string
    {
        $raw = bin2hex(random_bytes(32));
        static::query()->create([
            'user_id' => $user->id,
            'token_digest' => static::digest($raw),
            'expires_at' => Carbon::now('UTC')->addDays(self::TTL_DAYS),
        ]);

        return $raw;
    }

    public static function digest(string $raw): string
    {
        return hash('sha256', $raw);
    }

    public static function authenticate(?string $raw): ?self
    {
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $record = static::query()->where('token_digest', static::digest($raw))->first();
        if ($record === null) {
            return null;
        }

        if ($record->revoked_at !== null) {
            static::query()
                ->where('user_id', $record->user_id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => Carbon::now('UTC'), 'updated_at' => Carbon::now('UTC')]);

            return null;
        }

        if ($record->expires_at->lt(Carbon::now('UTC'))) {
            return null;
        }

        return $record;
    }

    public static function claimAtomically(int $id): bool
    {
        return static::query()
            ->where('id', $id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => Carbon::now('UTC'), 'updated_at' => Carbon::now('UTC')]) === 1;
    }

    public function revoke(): void
    {
        $this->forceFill(['revoked_at' => Carbon::now('UTC')])->save();
    }
}
