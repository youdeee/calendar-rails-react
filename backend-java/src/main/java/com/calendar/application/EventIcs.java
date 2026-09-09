package com.calendar.application;

import com.calendar.domain.Event;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

final class EventIcs {
    private static final DateTimeFormatter DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter UTC_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private EventIcs() {
    }

    static String body(Event event, Instant occurrenceStartAt, LocalDate occurrenceOn, Instant now) {
        String token = occurrenceOn != null ? occurrenceOn.toString() : UTC_STAMP.format(occurrenceStartAt);
        String uid = "event-" + event.getId() + "-" + token + "@calendar.local";
        return """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//calendar//EN
                BEGIN:VEVENT
                UID:%s
                DTSTAMP:%s
                %s
                %s
                SUMMARY:%s
                END:VEVENT
                END:VCALENDAR
                """.formatted(uid, UTC_STAMP.format(now), dtStart(event, occurrenceStartAt, occurrenceOn),
                dtEnd(event, occurrenceStartAt, occurrenceOn), escape(event.getTitle()));
    }

    private static String dtStart(Event event, Instant occurrenceStartAt, LocalDate occurrenceOn) {
        if (event.isAllDay()) {
            return "DTSTART;VALUE=DATE:" + DATE.format(occurrenceOn);
        }
        return "DTSTART:" + UTC_STAMP.format(occurrenceStartAt);
    }

    private static String dtEnd(Event event, Instant occurrenceStartAt, LocalDate occurrenceOn) {
        if (event.isAllDay()) {
            LocalDate lastOn = occurrenceOn.plusDays(event.getEndOn().toEpochDay() - event.getStartOn().toEpochDay());
            return "DTEND;VALUE=DATE:" + DATE.format(lastOn.plusDays(1));
        }
        Instant end = occurrenceStartAt.plusMillis(event.getEndAt().toEpochMilli() - event.getStartAt().toEpochMilli());
        return "DTEND:" + UTC_STAMP.format(end);
    }

    private static String escape(String text) {
        return text == null ? "" : text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n");
    }
}
