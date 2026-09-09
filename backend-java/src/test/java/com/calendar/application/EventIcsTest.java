package com.calendar.application;

import com.calendar.domain.Event;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertTrue;

class EventIcsTest {
    @Test
    void allDayUsesValueDate() {
        Event event = new Event();
        event.setId(1L);
        event.setTitle("Holiday");
        event.setAllDay(true);
        event.setStartOn(LocalDate.of(2026, 9, 10));
        event.setEndOn(LocalDate.of(2026, 9, 10));
        String ics = EventIcs.body(event, null, LocalDate.of(2026, 9, 10), Instant.parse("2026-09-09T09:00:00Z"));
        assertTrue(ics.contains("DTSTART;VALUE=DATE:20260910"));
        assertTrue(ics.contains("DTEND;VALUE=DATE:20260911"));
    }

    @Test
    void timedUsesUtcInstants() {
        Event event = new Event();
        event.setId(2L);
        event.setTitle("Lunch");
        event.setStartAt(Instant.parse("2026-09-10T06:00:00Z"));
        event.setEndAt(Instant.parse("2026-09-10T07:00:00Z"));
        String ics = EventIcs.body(event, Instant.parse("2026-09-10T06:00:00Z"), null, Instant.parse("2026-09-09T09:00:00Z"));
        assertTrue(ics.contains("DTSTART:20260910T060000Z"));
        assertTrue(ics.contains("DTEND:20260910T070000Z"));
    }
}
