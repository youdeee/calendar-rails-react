package com.calendar.application.exception;

public class NotFoundException extends RuntimeException {
    public NotFoundException() {
        super("Not Found");
    }
}
