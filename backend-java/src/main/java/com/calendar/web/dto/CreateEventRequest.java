package com.calendar.web.dto;

import java.time.Instant;

public record CreateEventRequest(
        String title,
        String description,
        Instant startAt,
        Instant endAt,
        Boolean allDay,
        RecurrenceParams recurrence
) {
}
