<?php

namespace App\Calendar;

use App\Models\Event;
use Carbon\Carbon;

final class EventIcs
{
    public static function body(Event $event, ?Carbon $occurrenceStartAt, ?Carbon $occurrenceOn, Carbon $now): string
    {
        $token = $occurrenceOn !== null
            ? $occurrenceOn->utc()->toDateString()
            : $occurrenceStartAt?->utc()->toIso8601String();
        $uid = 'event-'.$event->id.'-'.$token.'@calendar.local';

        return implode("\n", [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//calendar//EN',
            'BEGIN:VEVENT',
            'UID:'.$uid,
            'DTSTAMP:'.$now->copy()->utc()->format('Ymd\THis\Z'),
            self::dtStart($event, $occurrenceStartAt, $occurrenceOn),
            self::dtEnd($event, $occurrenceStartAt, $occurrenceOn),
            'SUMMARY:'.self::escape((string) $event->title),
            'END:VEVENT',
            'END:VCALENDAR',
        ])."\n";
    }

    private static function dtStart(Event $event, ?Carbon $occurrenceStartAt, ?Carbon $occurrenceOn): string
    {
        if ($event->all_day && $occurrenceOn !== null) {
            return 'DTSTART;VALUE=DATE:'.$occurrenceOn->utc()->format('Ymd');
        }

        return 'DTSTART:'.$occurrenceStartAt->copy()->utc()->format('Ymd\THis\Z');
    }

    private static function dtEnd(Event $event, ?Carbon $occurrenceStartAt, ?Carbon $occurrenceOn): string
    {
        if ($event->all_day && $occurrenceOn !== null) {
            $days = (int) $event->start_on->copy()->startOfDay()->diffInDays($event->end_on->copy()->startOfDay());
            $lastOn = $occurrenceOn->copy()->utc()->startOfDay()->addDays($days);

            return 'DTEND;VALUE=DATE:'.$lastOn->addDay()->format('Ymd');
        }
        $end = $occurrenceStartAt->copy()->addSeconds(
            $event->end_at->getTimestamp() - $event->start_at->getTimestamp(),
        );

        return 'DTEND:'.$end->utc()->format('Ymd\THis\Z');
    }

    private static function escape(string $text): string
    {
        return str_replace(['\\', ';', ',', "\n"], ['\\\\', '\;', '\,', '\n'], $text);
    }
}
