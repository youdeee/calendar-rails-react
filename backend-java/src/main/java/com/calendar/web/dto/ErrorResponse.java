package com.calendar.web.dto;

public record ErrorResponse(ErrorBody error) {
    public record ErrorBody(String message) {
    }

    public static ErrorResponse of(String message) {
        return new ErrorResponse(new ErrorBody(message));
    }
}
