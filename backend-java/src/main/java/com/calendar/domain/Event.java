package com.calendar.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@EqualsAndHashCode(of = "id")
public class Event {
    private Long id;
    private Long userId;
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;
    private boolean allDay;
    private String recurrenceRule;
    private Instant createdAt;
    private Instant updatedAt;

    public boolean recurring() {
        return recurrenceRule != null && !recurrenceRule.isBlank();
    }
}
