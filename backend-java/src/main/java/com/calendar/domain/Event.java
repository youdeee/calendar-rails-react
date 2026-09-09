package com.calendar.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Getter
@Setter
@EqualsAndHashCode(of = "id")
public class Event {
    public static final int REMINDER_MINUTES_MAX = 43_200;

    private Long id;
    private Long userId;
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;
    private LocalDate startOn;
    private LocalDate endOn;
    private boolean allDay;
    private Integer reminderMinutes;
    private String recurrenceRule;
    private Instant createdAt;
    private Instant updatedAt;

    public boolean recurring() {
        return recurrenceRule != null && !recurrenceRule.isBlank();
    }

    public Instant allDayStartInstant(LocalDate occurrenceOn, ZoneId zone) {
        return occurrenceOn.atStartOfDay(zone).toInstant();
    }
}
