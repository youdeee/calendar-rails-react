package com.calendar.application;

import com.calendar.application.exception.InvalidGoogleTokenException;
import com.calendar.application.exception.UnauthorizedException;
import com.calendar.domain.RefreshToken;
import com.calendar.domain.RefreshTokenRepository;
import com.calendar.domain.User;
import com.calendar.domain.UserRepository;
import com.calendar.infrastructure.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class AuthService {
    public static final Duration REFRESH_TTL = Duration.ofDays(30);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GoogleTokenVerifier googleTokenVerifier;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    @Transactional
    public IssuedSession login(String idToken) {
        GoogleProfile profile = googleTokenVerifier.verify(idToken);
        if (!profile.emailVerified()) {
            throw new InvalidGoogleTokenException();
        }
        return issueSession(upsertUser(profile));
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public IssuedSession refresh(String rawRefreshToken) {
        RefreshToken current = authenticateRefreshToken(rawRefreshToken);
        if (!refreshTokenRepository.claimIfActive(current.getId())) {
            throw new UnauthorizedException();
        }
        User user = userRepository.findById(current.getUserId()).orElseThrow(UnauthorizedException::new);
        return issueSession(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByDigest(digest(rawRefreshToken))
                .ifPresent(token -> refreshTokenRepository.revoke(token.getId()));
    }

    private User upsertUser(GoogleProfile profile) {
        Instant now = Instant.now();
        User user = userRepository.findByEmail(profile.email()).orElseGet(User::new);
        user.setEmail(profile.email());
        user.setGoogleUid(profile.googleUid());
        user.setName(profile.name() == null || profile.name().isBlank() ? profile.email() : profile.name());
        user.setAvatarUrl(profile.picture());
        user.setUpdatedAt(now);
        if (user.getId() == null) {
            user.setCreatedAt(now);
        }
        return userRepository.save(user);
    }

    private IssuedSession issueSession(User user) {
        String rawRefresh = HexFormat.of().formatHex(randomBytes(32));
        Instant now = Instant.now();
        RefreshToken token = new RefreshToken();
        token.setUserId(user.getId());
        token.setTokenDigest(digest(rawRefresh));
        token.setExpiresAt(now.plus(REFRESH_TTL));
        token.setCreatedAt(now);
        token.setUpdatedAt(now);
        refreshTokenRepository.insert(token);
        return new IssuedSession(jwtService.encode(user.getId()), rawRefresh, user);
    }

    private RefreshToken authenticateRefreshToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException();
        }
        RefreshToken token = refreshTokenRepository.findByDigest(digest(rawRefreshToken))
                .orElseThrow(UnauthorizedException::new);
        if (token.isRevoked()) {
            refreshTokenRepository.revokeAllActiveByUserId(token.getUserId());
            throw new UnauthorizedException();
        }
        if (token.isExpired(Instant.now())) {
            throw new UnauthorizedException();
        }
        return token;
    }

    private static String digest(String raw) {
        try {
            byte[] hashed = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    public record IssuedSession(String accessToken, String rawRefreshToken, User user) {
    }
}
