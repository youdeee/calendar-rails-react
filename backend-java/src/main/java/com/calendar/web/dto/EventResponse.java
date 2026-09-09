package com.calendar.web.dto;

import java.time.Instant;
import java.time.LocalDate;

public record EventResponse(
        Long id,
        String title,
        String description,
        Instant startAt,
        Instant endAt,
        LocalDate startOn,
        LocalDate endOn,
        boolean allDay,
        Integer reminderMinutes,
        boolean recurring,
        RecurrenceParams recurrence
) {
}
