package com.calendar.domain;

import java.util.Optional;

public interface RefreshTokenRepository {
    void insert(RefreshToken token);

    Optional<RefreshToken> findByDigest(String tokenDigest);

    boolean claimIfActive(Long id);

    void revokeAllActiveByUserId(Long userId);

    void revoke(Long id);
}
