package com.calendar.infrastructure.ratelimit;

import com.calendar.config.AppProperties;
import com.calendar.web.dto.ErrorResponse;
import tools.jackson.databind.json.JsonMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {
    private final AppProperties.RateLimit properties;
    private final JsonMapper jsonMapper;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!properties.enabled()) {
            filterChain.doFilter(request, response);
            return;
        }
        String ip = clientIp(request);
        boolean allowed = allow("all:" + ip, properties.requestsPerFiveMinutes(), Duration.ofMinutes(5));
        if ("POST".equalsIgnoreCase(request.getMethod()) && "/api/auth/login".equals(request.getRequestURI())) {
            allowed = allow("login:" + ip, properties.loginPerMinute(), Duration.ofMinutes(1)) && allowed;
        }
        if ("POST".equalsIgnoreCase(request.getMethod()) && "/api/auth/refresh".equals(request.getRequestURI())) {
            allowed = allow("refresh:" + ip, properties.refreshPerMinute(), Duration.ofMinutes(1)) && allowed;
        }
        if (!allowed) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            jsonMapper.writeValue(response.getOutputStream(), ErrorResponse.of("Too Many Requests"));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean allow(String key, int limit, Duration period) {
        long now = System.currentTimeMillis();
        Window window = windows.compute(key, (ignored, existing) -> {
            if (existing == null || now - existing.startMillis >= period.toMillis()) {
                return new Window(now, 1);
            }
            existing.count += 1;
            return existing;
        });
        return window.count <= limit;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class Window {
        private final long startMillis;
        private int count;

        private Window(long startMillis, int count) {
            this.startMillis = startMillis;
            this.count = count;
        }
    }
}
