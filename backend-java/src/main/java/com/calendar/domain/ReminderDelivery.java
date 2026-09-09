package com.calendar.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@EqualsAndHashCode(of = "id")
public class ReminderDelivery {
    private Long id;
    private Long userId;
    private Long eventId;
    private Instant occurrenceStartAt;
    private Instant deliveredAt;
    private Instant createdAt;
    private Instant updatedAt;
}
