package com.calendar.web.dto;

import tools.jackson.databind.annotation.JsonDeserialize;

public record RecurrenceParams(
        String frequency,
        @JsonDeserialize(using = FlexibleIntDeserializer.class) Integer interval,
        String until
) {
}
