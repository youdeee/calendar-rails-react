package com.calendar.infrastructure.google;

import com.calendar.application.GoogleProfile;
import com.calendar.application.GoogleTokenVerifier;
import com.calendar.application.exception.InvalidGoogleTokenException;
import com.calendar.config.AppProperties;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class GoogleAuthConfig {
    @Bean
    @ConditionalOnMissingBean(GoogleTokenVerifier.class)
    GoogleTokenVerifier googleTokenVerifier(AppProperties properties) throws Exception {
        String clientId = properties.google().clientId();
        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance())
                .setAudience(clientId == null || clientId.isBlank() ? List.of() : List.of(clientId))
                .build();
        return idToken -> {
            try {
                GoogleIdToken token = verifier.verify(idToken);
                if (token == null) {
                    throw new InvalidGoogleTokenException();
                }
                GoogleIdToken.Payload payload = token.getPayload();
                return new GoogleProfile(
                        payload.getSubject(),
                        payload.getEmail(),
                        Boolean.TRUE.equals(payload.getEmailVerified()),
                        (String) payload.get("name"),
                        (String) payload.get("picture")
                );
            } catch (InvalidGoogleTokenException e) {
                throw e;
            } catch (Exception e) {
                throw new InvalidGoogleTokenException();
            }
        };
    }
}
