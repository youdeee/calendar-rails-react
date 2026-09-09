<?php

namespace Tests\Unit;

use App\Calendar\RecurrenceExpander;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class RecurrenceExpanderTest extends TestCase
{
    public function test_single_event_in_range(): void
    {
        $start = Carbon::parse('2026-08-10T10:00:00Z');
        $end = Carbon::parse('2026-08-10T11:00:00Z');
        $got = RecurrenceExpander::occurrencesBetween(
            $start, $end, Carbon::parse('2026-08-01T00:00:00Z'), Carbon::parse('2026-08-31T00:00:00Z'), null,
        );
        $this->assertCount(1, $got);
        $this->assertTrue($got[0]->equalTo($start));
    }

    public function test_single_event_out_of_range(): void
    {
        $got = RecurrenceExpander::occurrencesBetween(
            Carbon::parse('2026-08-10T10:00:00Z'),
            Carbon::parse('2026-08-10T11:00:00Z'),
            Carbon::parse('2026-09-01T00:00:00Z'),
            Carbon::parse('2026-09-30T00:00:00Z'),
            null,
        );
        $this->assertSame([], $got);
    }

    public function test_expands_weekly_across_august(): void
    {
        $got = RecurrenceExpander::occurrencesBetween(
            Carbon::parse('2026-08-03T10:00:00Z'),
            Carbon::parse('2026-08-03T11:00:00Z'),
            Carbon::parse('2026-08-01T00:00:00Z'),
            Carbon::parse('2026-08-31T00:00:00Z'),
            ['frequency' => 'weekly', 'interval' => 1],
        );
        $this->assertCount(5, $got);
        $this->assertSame('2026-08-03', $got[0]->utc()->toDateString());
    }

    public function test_includes_occurrence_later_in_range_end_day(): void
    {
        $start = Carbon::parse('2026-08-10T10:00:00Z');
        $got = RecurrenceExpander::occurrencesBetween(
            $start, Carbon::parse('2026-08-10T11:00:00Z'),
            Carbon::parse('2026-08-01T00:00:00Z'), Carbon::parse('2026-08-10T00:00:00Z'), null,
        );
        $this->assertCount(1, $got);
        $this->assertTrue($got[0]->equalTo($start));
    }

    public function test_excludes_occurrence_on_day_after_range_end(): void
    {
        $got = RecurrenceExpander::occurrencesBetween(
            Carbon::parse('2026-08-11T00:30:00Z'),
            Carbon::parse('2026-08-11T01:30:00Z'),
            Carbon::parse('2026-08-01T00:00:00Z'),
            Carbon::parse('2026-08-10T00:00:00Z'),
            null,
        );
        $this->assertSame([], $got);
    }

    public function test_includes_multi_day_overlap_starting_before_range(): void
    {
        $start = Carbon::parse('2026-08-05T10:00:00Z');
        $got = RecurrenceExpander::occurrencesBetween(
            $start, Carbon::parse('2026-08-12T10:00:00Z'),
            Carbon::parse('2026-08-10T00:00:00Z'), Carbon::parse('2026-08-20T00:00:00Z'), null,
        );
        $this->assertCount(1, $got);
        $this->assertTrue($got[0]->equalTo($start));
    }

    public function test_includes_recurring_multi_day_occurrence_starting_before_range(): void
    {
        $got = RecurrenceExpander::occurrencesBetween(
            Carbon::parse('2026-08-03T00:00:00Z'),
            Carbon::parse('2026-08-06T00:00:00Z'),
            Carbon::parse('2026-08-05T00:00:00Z'),
            Carbon::parse('2026-08-10T00:00:00Z'),
            ['frequency' => 'weekly', 'interval' => 1],
        );
        $dates = array_map(fn ($t) => $t->utc()->toIso8601String(), $got);
        $this->assertContains(Carbon::parse('2026-08-03T00:00:00Z')->toIso8601String(), $dates);
        $this->assertContains(Carbon::parse('2026-08-10T00:00:00Z')->toIso8601String(), $dates);
    }

    public function test_all_day_event_returns_civil_date_in_zone(): void
    {
        $got = RecurrenceExpander::allDayOccurrencesBetween(
            Carbon::parse('2026-08-10'),
            Carbon::parse('2026-08-10'),
            Carbon::parse('2026-08-01T00:00:00Z'),
            Carbon::parse('2026-08-31T00:00:00Z'),
            'Asia/Tokyo',
            null,
        );
        $this->assertCount(1, $got);
        $this->assertSame('2026-08-10', $got[0]->toDateString());
    }
}
