package com.calendar.web;

import com.calendar.application.AuthService;
import com.calendar.application.exception.BadRequestException;
import com.calendar.config.AppProperties;
import com.calendar.web.dto.AuthResponse;
import com.calendar.web.dto.LoginRequest;
import com.calendar.web.mapping.UserDtoMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    static final String REFRESH_COOKIE = "refresh_token";
    static final String REFRESH_COOKIE_PATH = "/api/auth";

    private final AuthService authService;
    private final UserDtoMapper userDtoMapper;
    private final AppProperties appProperties;

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse login(@RequestBody LoginRequest request, HttpServletResponse response) {
        if (request == null || request.idToken() == null || request.idToken().isBlank()) {
            throw new BadRequestException("param is missing or the value is empty: id_token");
        }
        AuthService.IssuedSession session = authService.login(request.idToken());
        writeRefreshCookie(response, session.rawRefreshToken());
        return new AuthResponse(session.accessToken(), userDtoMapper.toResponse(session.user()));
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletResponse response
    ) {
        AuthService.IssuedSession session = authService.refresh(refreshToken);
        writeRefreshCookie(response, session.rawRefreshToken());
        return new AuthResponse(session.accessToken(), userDtoMapper.toResponse(session.user()));
    }

    @DeleteMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletResponse response
    ) {
        authService.logout(refreshToken);
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(appProperties.cookie().secure())
                .sameSite(appProperties.cookie().sameSite())
                .path(REFRESH_COOKIE_PATH)
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void writeRefreshCookie(HttpServletResponse response, String rawToken) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, rawToken)
                .httpOnly(true)
                .secure(appProperties.cookie().secure())
                .sameSite(appProperties.cookie().sameSite())
                .path(REFRESH_COOKIE_PATH)
                .maxAge(Duration.ofDays(30))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
