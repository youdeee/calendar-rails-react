<?php

namespace Tests\Unit;

use App\Calendar\EventIcs;
use App\Models\Event;
use Carbon\Carbon;
use Tests\TestCase;

class EventIcsTest extends TestCase
{
    public function test_timed_event_uses_utc_stamps(): void
    {
        $event = new Event([
            'title' => 'Lunch',
            'start_at' => Carbon::parse('2026-09-10T06:00:00Z'),
            'end_at' => Carbon::parse('2026-09-10T07:00:00Z'),
        ]);
        $event->id = 1;
        $ics = EventIcs::body(
            $event,
            Carbon::parse('2026-09-10T06:00:00Z'),
            null,
            Carbon::parse('2026-09-10T05:45:00Z'),
        );
        $this->assertStringContainsString('DTSTART:20260910T060000Z', $ics);
        $this->assertStringContainsString('BEGIN:VCALENDAR', $ics);
    }
}
