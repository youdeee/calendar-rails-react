<?php

namespace App\Calendar;

use Carbon\Carbon;

final class RecurrenceExpander
{
    private const MAX_OCCURRENCES = 400;

    /**
     * @param  array{frequency: string, interval: int, until?: ?string}|null  $rule
     * @return list<Carbon>
     */
    public static function occurrencesBetween(
        Carbon $startAt,
        Carbon $endAt,
        Carbon $rangeStart,
        Carbon $rangeEnd,
        ?array $rule,
    ): array {
        $inclusiveRangeEnd = self::endOfUtcDay($rangeEnd);
        $duration = $endAt->getTimestamp() - $startAt->getTimestamp();

        if ($rule === null) {
            if (! $startAt->gt($inclusiveRangeEnd) && ! $endAt->lt($rangeStart)) {
                return [$startAt->copy()];
            }

            return [];
        }

        $untilDate = null;
        if (! empty($rule['until'])) {
            $untilDate = Carbon::createFromFormat('Y-m-d', $rule['until'], 'UTC')?->startOfDay();
        }

        $occurrences = [];
        $cursor = $startAt->copy()->utc();
        for ($safety = 0; ! $cursor->gt($inclusiveRangeEnd) && $safety < 10_000; $safety++) {
            if ($untilDate !== null && $cursor->copy()->utc()->startOfDay()->gt($untilDate)) {
                break;
            }
            $occurrenceEnd = $cursor->copy()->addSeconds($duration);
            if (! $cursor->gt($inclusiveRangeEnd) && ! $occurrenceEnd->lt($rangeStart)) {
                $occurrences[] = $cursor->copy();
                if (count($occurrences) >= self::MAX_OCCURRENCES) {
                    break;
                }
            }
            $cursor = self::nextOccurrence($cursor, $rule['frequency'] ?? 'daily', (int) ($rule['interval'] ?? 1));
        }

        return $occurrences;
    }

    public static function endOfUtcDay(Carbon $instant): Carbon
    {
        return $instant->copy()->utc()->endOfDay();
    }

    private static function nextOccurrence(Carbon $cursor, string $frequency, int $interval): Carbon
    {
        $next = $cursor->copy()->utc();

        return match ($frequency) {
            'daily' => $next->addDays($interval),
            'weekly' => $next->addWeeks($interval),
            'monthly' => $next->addMonths($interval),
            default => $next->addDays($interval),
        };
    }
}
