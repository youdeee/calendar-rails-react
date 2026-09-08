package com.calendar.web.dto;

import java.time.Instant;

public record EventResponse(
        Long id,
        String title,
        String description,
        Instant startAt,
        Instant endAt,
        boolean allDay,
        boolean recurring,
        RecurrenceParams recurrence
) {
}
