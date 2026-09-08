package com.calendar.infrastructure.persistence;

import com.calendar.domain.RefreshToken;
import com.calendar.domain.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class MyBatisRefreshTokenRepository implements RefreshTokenRepository {
    private final RefreshTokenMapper mapper;

    @Override
    public void insert(RefreshToken token) {
        mapper.insert(token);
    }

    @Override
    public Optional<RefreshToken> findByDigest(String tokenDigest) {
        return Optional.ofNullable(mapper.findByDigest(tokenDigest));
    }

    @Override
    public boolean claimIfActive(Long id) {
        return mapper.claimIfActive(id) == 1;
    }

    @Override
    public void revokeAllActiveByUserId(Long userId) {
        mapper.revokeAllActiveByUserId(userId);
    }

    @Override
    public void revoke(Long id) {
        mapper.revoke(id);
    }
}
