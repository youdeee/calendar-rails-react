package com.calendar.web;

import com.calendar.ApiTestSupport;
import com.calendar.application.GoogleProfile;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthApiTest extends ApiTestSupport {
    @Test
    void loginCreatesSession() throws Exception {
        stubGoogleLogin();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id_token\":\"valid\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.access_token").isString())
                .andExpect(jsonPath("$.user.email").value("a@example.com"))
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andExpect(cookie().path("refresh_token", "/api/auth"));
    }

    @Test
    void loginRejectsInvalidGoogleToken() throws Exception {
        stubInvalidGoogle();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id_token\":\"bad\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Invalid Google token"));
    }

    @Test
    void loginRejectsUnverifiedEmail() throws Exception {
        when(googleTokenVerifier.verify(anyString())).thenReturn(
                new GoogleProfile("google-1", "a@example.com", false, "Taro", null));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id_token\":\"valid\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        String refresh = loginAndRawRefreshToken();

        mockMvc.perform(delete("/api/auth/logout").cookie(new Cookie("refresh_token", refresh)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", refresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithoutCookieIsNoContent() throws Exception {
        mockMvc.perform(delete("/api/auth/logout")).andExpect(status().isNoContent());
    }

    @Test
    void refreshRotatesToken() throws Exception {
        String original = loginAndRawRefreshToken();

        var result = mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", original)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isString())
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().value("refresh_token", not(original)))
                .andReturn();
        String rotated = result.getResponse().getCookie("refresh_token").getValue();

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", rotated)))
                .andExpect(status().isOk());
    }

    @Test
    void reusedRefreshTokenRevokesFamily() throws Exception {
        String original = loginAndRawRefreshToken();
        var result = mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", original)))
                .andExpect(status().isOk())
                .andReturn();
        String rotated = result.getResponse().getCookie("refresh_token").getValue();

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", original)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", rotated)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithoutCookieIsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/refresh")).andExpect(status().isUnauthorized());
    }
}
