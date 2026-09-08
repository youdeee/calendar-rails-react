package com.calendar.web;

import com.calendar.ApiTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "app.rate-limit.enabled=true")
class RateLimitApiTest extends ApiTestSupport {
    @Test
    void throttlesLoginAfterTenRequestsPerMinute() throws Exception {
        stubInvalidGoogle();
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", "10.0.0.1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"id_token\":\"x\"}"))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "10.0.0.1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id_token\":\"x\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void throttlesAnyEndpointAfter300RequestsPerFiveMinutes() throws Exception {
        for (int i = 0; i < 300; i++) {
            mockMvc.perform(get("/actuator/health").header("X-Forwarded-For", "10.0.0.2")).andExpect(status().isOk());
        }
        mockMvc.perform(get("/actuator/health").header("X-Forwarded-For", "10.0.0.2")).andExpect(status().isTooManyRequests());
    }
}
