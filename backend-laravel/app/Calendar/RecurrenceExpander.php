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

    /**
     * @param  array{frequency: string, interval: int, until?: ?string}|null  $rule
     * @return list<Carbon>
     */
    public static function allDayOccurrencesBetween(
        Carbon $startOn,
        Carbon $endOn,
        Carbon $rangeStart,
        Carbon $rangeEnd,
        string $timezone,
        ?array $rule,
    ): array {
        $inclusiveRangeEnd = self::endOfUtcDay($rangeEnd);
        $durationDays = (int) self::civilUtc($startOn)->diffInDays(self::civilUtc($endOn));
        if ($rule === null) {
            if (self::spansInstantRange($startOn, $endOn, $rangeStart, $inclusiveRangeEnd, $timezone)) {
                return [self::civilUtc($startOn)];
            }

            return [];
        }

        $untilDate = null;
        if (! empty($rule['until'])) {
            $untilDate = Carbon::createFromFormat('Y-m-d', $rule['until'], 'UTC')?->startOfDay();
        }

        $occurrences = [];
        $cursor = self::civilUtc($startOn);
        for ($safety = 0; $safety < 10_000; $safety++) {
            if ($cursor->gt($inclusiveRangeEnd)) {
                break;
            }
            if ($untilDate !== null && $cursor->gt($untilDate)) {
                break;
            }
            $occurrenceEndOn = $cursor->copy()->addDays($durationDays);
            if (self::spansInstantRange($cursor, $occurrenceEndOn, $rangeStart, $inclusiveRangeEnd, $timezone)) {
                $occurrences[] = $cursor->copy();
                if (count($occurrences) >= self::MAX_OCCURRENCES) {
                    break;
                }
            }
            $cursor = self::nextDate($cursor, $rule['frequency'] ?? 'daily', (int) ($rule['interval'] ?? 1));
        }

        return $occurrences;
    }

    public static function spansInstantRange(
        Carbon $firstOn,
        Carbon $lastOn,
        Carbon $rangeStart,
        Carbon $inclusiveRangeEnd,
        string $timezone,
    ): bool {
        $starts = self::allDayStartInstant($firstOn, $timezone);
        $ends = self::allDayStartInstant($lastOn, $timezone)->addDay();

        return $starts->lt($inclusiveRangeEnd) && $ends->gt($rangeStart);
    }

    public static function allDayStartInstant(Carbon $occurrenceOn, string $timezone): Carbon
    {
        $utc = self::civilUtc($occurrenceOn);

        return Carbon::create($utc->year, $utc->month, $utc->day, 0, 0, 0, $timezone)->utc();
    }

    public static function endOfUtcDay(Carbon $instant): Carbon
    {
        return $instant->copy()->utc()->endOfDay();
    }

    private static function civilUtc(Carbon $date): Carbon
    {
        return Carbon::create($date->copy()->utc()->year, $date->copy()->utc()->month, $date->copy()->utc()->day, 0, 0, 0, 'UTC');
    }

    private static function nextDate(Carbon $cursor, string $frequency, int $interval): Carbon
    {
        $next = self::civilUtc($cursor);

        return match ($frequency) {
            'daily' => $next->addDays($interval),
            'weekly' => $next->addWeeks($interval),
            'monthly' => $next->addMonths($interval),
            default => $next->addDays($interval),
        };
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
