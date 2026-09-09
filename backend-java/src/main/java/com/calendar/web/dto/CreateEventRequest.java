package com.calendar.web.dto;

import java.time.Instant;
import java.time.LocalDate;

public record CreateEventRequest(
        String title,
        String description,
        Instant startAt,
        Instant endAt,
        LocalDate startOn,
        LocalDate endOn,
        Boolean allDay,
        Integer reminderMinutes,
        RecurrenceParams recurrence
) {
}
