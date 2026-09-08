package com.calendar.web.dto;

public record AuthResponse(String accessToken, UserResponse user) {
}
