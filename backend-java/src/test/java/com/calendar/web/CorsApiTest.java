package com.calendar.web;

import com.calendar.ApiTestSupport;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CorsApiTest extends ApiTestSupport {
    @Test
    void reflectsConfiguredOrigin() throws Exception {
        mockMvc.perform(get("/api/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Authorization", "Bearer bogus"))
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void rejectsUnknownOrigin() throws Exception {
        mockMvc.perform(get("/api/me")
                        .header("Origin", "http://evil.example.com")
                        .header("Authorization", "Bearer bogus"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void allowsCredentialsOnAuthRoutes() throws Exception {
        stubInvalidGoogle();
        mockMvc.perform(post("/api/auth/login")
                        .header("Origin", "http://localhost:5173")
                        .contentType("application/json")
                        .content("{\"id_token\":\"x\"}"))
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void doesNotAllowCredentialsOnNonAuthApi() throws Exception {
        mockMvc.perform(get("/api/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Authorization", "Bearer bogus"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }
}
