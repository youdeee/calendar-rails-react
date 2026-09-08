package com.calendar.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Cors cors,
        Google google,
        Cookie cookie,
        RateLimit rateLimit
) {
    public record Jwt(String secret, Duration accessTokenTtl) {
    }

    public record Cors(String frontendOrigin) {
    }

    public record Google(String clientId) {
    }

    public record Cookie(boolean secure, String sameSite) {
    }

    public record RateLimit(
            boolean enabled,
            int loginPerMinute,
            int refreshPerMinute,
            int requestsPerFiveMinutes
    ) {
    }
}
