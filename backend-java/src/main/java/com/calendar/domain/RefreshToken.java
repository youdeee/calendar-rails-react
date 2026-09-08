package com.calendar.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@EqualsAndHashCode(of = "id")
public class RefreshToken {
    private Long id;
    private Long userId;
    private String tokenDigest;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant createdAt;
    private Instant updatedAt;

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpired(Instant now) {
        return expiresAt.isBefore(now);
    }
}
