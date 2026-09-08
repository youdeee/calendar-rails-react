package com.calendar.web.dto;

import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

public class FlexibleIntDeserializer extends ValueDeserializer<Integer> {
    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) {
        return switch (parser.currentToken()) {
            case VALUE_NUMBER_INT, VALUE_NUMBER_FLOAT -> parser.getIntValue();
            case VALUE_STRING -> parse(parser.getValueAsString());
            case VALUE_NULL -> null;
            default -> 0;
        };
    }

    private static Integer parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
