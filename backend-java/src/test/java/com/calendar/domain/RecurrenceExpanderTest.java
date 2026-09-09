package com.calendar.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecurrenceExpanderTest {
    @Test
    void singleEventInRange() {
        Event event = event("2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z");
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-08-01T00:00:00Z"), Instant.parse("2026-08-31T00:00:00Z"), null);
        assertEquals(List.of(event.getStartAt()), result);
    }

    @Test
    void singleEventOutOfRange() {
        Event event = event("2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z");
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-09-01T00:00:00Z"), Instant.parse("2026-09-30T00:00:00Z"), null);
        assertTrue(result.isEmpty());
    }

    @Test
    void expandsWeeklyAcrossAugust() {
        Event event = event("2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z");
        Recurrence recurrence = new Recurrence("weekly", 1, null);
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-08-01T00:00:00Z"), Instant.parse("2026-08-31T00:00:00Z"), recurrence);
        assertEquals(5, result.size());
        assertEquals(LocalDate.of(2026, 8, 3), result.getFirst().atZone(ZoneOffset.UTC).toLocalDate());
    }

    @Test
    void includesOccurrenceLaterInRangeEndDay() {
        Event event = event("2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z");
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-08-01T00:00:00Z"), Instant.parse("2026-08-10T00:00:00Z"), null);
        assertEquals(List.of(event.getStartAt()), result);
    }

    @Test
    void excludesOccurrenceOnDayAfterRangeEnd() {
        Event event = event("2026-08-11T00:30:00Z", "2026-08-11T01:30:00Z");
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-08-01T00:00:00Z"), Instant.parse("2026-08-10T00:00:00Z"), null);
        assertTrue(result.isEmpty());
    }

    @Test
    void includesMultiDayOverlapStartingBeforeRange() {
        Event event = event("2026-08-05T10:00:00Z", "2026-08-12T10:00:00Z");
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-08-10T00:00:00Z"), Instant.parse("2026-08-20T00:00:00Z"), null);
        assertEquals(List.of(event.getStartAt()), result);
    }

    @Test
    void includesRecurringMultiDayOccurrenceStartingBeforeRange() {
        Event event = event("2026-08-03T00:00:00Z", "2026-08-06T00:00:00Z");
        Recurrence recurrence = new Recurrence("weekly", 1, null);
        List<Instant> result = RecurrenceExpander.occurrencesBetween(
                event, Instant.parse("2026-08-05T00:00:00Z"), Instant.parse("2026-08-10T00:00:00Z"), recurrence);
        assertTrue(result.contains(Instant.parse("2026-08-03T00:00:00Z")));
        assertTrue(result.contains(Instant.parse("2026-08-10T00:00:00Z")));
    }

    @Test
    void allDayEventReturnsCivilDateInZone() {
        Event event = new Event();
        event.setAllDay(true);
        event.setStartOn(LocalDate.of(2026, 8, 10));
        event.setEndOn(LocalDate.of(2026, 8, 10));
        List<LocalDate> result = RecurrenceExpander.allDayOccurrencesBetween(
                event,
                Instant.parse("2026-08-01T00:00:00Z"),
                Instant.parse("2026-08-31T00:00:00Z"),
                java.time.ZoneId.of("Asia/Tokyo"),
                null);
        assertEquals(List.of(LocalDate.of(2026, 8, 10)), result);
    }

    private static Event event(String start, String end) {
        Event event = new Event();
        event.setStartAt(Instant.parse(start));
        event.setEndAt(Instant.parse(end));
        return event;
    }
}
