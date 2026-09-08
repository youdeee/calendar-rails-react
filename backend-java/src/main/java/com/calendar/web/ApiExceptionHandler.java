package com.calendar.web;

import com.calendar.application.exception.BadRequestException;
import com.calendar.application.exception.InvalidGoogleTokenException;
import com.calendar.application.exception.NotFoundException;
import com.calendar.application.exception.UnauthorizedException;
import com.calendar.application.exception.UnprocessableException;
import com.calendar.web.dto.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import tools.jackson.core.JacksonException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(UnauthorizedException.class)
    ResponseEntity<ErrorResponse> unauthorized(UnauthorizedException exception) {
        return error(HttpStatus.UNAUTHORIZED, exception.getMessage());
    }

    @ExceptionHandler(InvalidGoogleTokenException.class)
    ResponseEntity<ErrorResponse> invalidGoogle(InvalidGoogleTokenException exception) {
        return error(HttpStatus.UNAUTHORIZED, exception.getMessage());
    }

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<ErrorResponse> notFound(NotFoundException exception) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(UnprocessableException.class)
    ResponseEntity<ErrorResponse> unprocessable(UnprocessableException exception) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, exception.getMessage());
    }

    @ExceptionHandler(BadRequestException.class)
    ResponseEntity<ErrorResponse> badRequest(BadRequestException exception) {
        return error(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ErrorResponse> missingParam(MissingServletRequestParameterException exception) {
        return error(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> unreadable(HttpMessageNotReadableException exception) {
        if (isRecurrenceShapeError(exception)) {
            return error(HttpStatus.BAD_REQUEST, "recurrence must be an object");
        }
        return error(HttpStatus.BAD_REQUEST, "invalid request");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> serverError(Exception exception) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error");
    }

    private static boolean isRecurrenceShapeError(HttpMessageNotReadableException exception) {
        Throwable cause = exception.getCause();
        while (cause != null) {
            if (cause instanceof JacksonException jackson && jackson.getPath() != null) {
                boolean recurrenceField = jackson.getPath().stream()
                        .anyMatch(reference -> "recurrence".equals(reference.getPropertyName()));
                if (recurrenceField) {
                    return true;
                }
            }
            cause = cause.getCause();
        }
        return exception.getMessage() != null && exception.getMessage().contains("recurrence");
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(ErrorResponse.of(message));
    }
}
