package com.calendar.infrastructure.security;

import com.calendar.config.AppProperties;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Component
public class JwtService {
    private final byte[] secret;
    private final AppProperties.Jwt jwt;

    public JwtService(AppProperties properties) {
        this.jwt = properties.jwt();
        this.secret = properties.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 bytes for HS256");
        }
    }

    public String encode(Long userId) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(Long.toString(userId))
                    .expirationTime(Date.from(Instant.now().plus(jwt.accessTokenTtl())))
                    .build();
            SignedJWT signed = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            signed.sign(new MACSigner(secret));
            return signed.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to sign JWT", e);
        }
    }

    public Optional<Long> parseUserId(String token) {
        try {
            SignedJWT signed = SignedJWT.parse(token);
            if (!signed.verify(new MACVerifier(secret))) {
                return Optional.empty();
            }
            JWTClaimsSet claims = signed.getJWTClaimsSet();
            Date expiration = claims.getExpirationTime();
            if (expiration == null || expiration.toInstant().isBefore(Instant.now())) {
                return Optional.empty();
            }
            return Optional.of(Long.parseLong(claims.getSubject()));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
