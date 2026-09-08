package com.calendar.domain;

import java.util.Set;

public record Recurrence(String frequency, int interval, String until) {
    public static final Set<String> ALLOWED_FREQUENCIES = Set.of("daily", "weekly", "monthly");
}
