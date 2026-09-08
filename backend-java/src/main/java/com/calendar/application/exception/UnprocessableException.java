package com.calendar.application.exception;

public class UnprocessableException extends RuntimeException {
    public UnprocessableException(String message) {
        super(message);
    }
}
