package com.calendar.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

public final class RecurrenceExpander {
    private static final int MAX_OCCURRENCES = 400;

    private RecurrenceExpander() {
    }

    public static List<Instant> occurrencesBetween(Event event, Instant rangeStart, Instant rangeEnd, Recurrence recurrence) {
        Instant inclusiveRangeEnd = endOfUtcDay(rangeEnd);
        Duration duration = Duration.between(event.getStartAt(), event.getEndAt());
        if (recurrence == null) {
            if (!event.getStartAt().isAfter(inclusiveRangeEnd) && !event.getEndAt().isBefore(rangeStart)) {
                return List.of(event.getStartAt());
            }
            return List.of();
        }

        List<Instant> occurrences = new ArrayList<>();
        Instant cursor = event.getStartAt();
        LocalDate untilDate = parseUntil(recurrence.until());
        int safety = 0;
        while (!cursor.isAfter(inclusiveRangeEnd) && safety++ < 10_000) {
            if (untilDate != null && cursor.atZone(ZoneOffset.UTC).toLocalDate().isAfter(untilDate)) {
                break;
            }
            Instant occurrenceEnd = cursor.plus(duration);
            if (!cursor.isAfter(inclusiveRangeEnd) && !occurrenceEnd.isBefore(rangeStart)) {
                occurrences.add(cursor);
                if (occurrences.size() >= MAX_OCCURRENCES) {
                    break;
                }
            }
            cursor = nextOccurrence(cursor, recurrence.frequency(), recurrence.interval());
        }
        return occurrences;
    }

    public static Instant endOfUtcDay(Instant instant) {
        return instant.atZone(ZoneOffset.UTC).toLocalDate().atTime(LocalTime.MAX).toInstant(ZoneOffset.UTC);
    }

    private static Instant nextOccurrence(Instant cursor, String frequency, int interval) {
        return switch (frequency) {
            case "daily" -> cursor.atZone(ZoneOffset.UTC).plusDays(interval).toInstant();
            case "weekly" -> cursor.atZone(ZoneOffset.UTC).plusWeeks(interval).toInstant();
            case "monthly" -> cursor.atZone(ZoneOffset.UTC).plusMonths(interval).toInstant();
            default -> cursor.atZone(ZoneOffset.UTC).plusDays(interval).toInstant();
        };
    }

    private static LocalDate parseUntil(String until) {
        if (until == null || until.isBlank()) {
            return null;
        }
        return LocalDate.parse(until);
    }
}
