package com.calendar.application.exception;

public class InvalidGoogleTokenException extends RuntimeException {
    public InvalidGoogleTokenException() {
        super("Invalid Google token");
    }
}
