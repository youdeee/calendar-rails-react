package com.calendar.web;

import com.calendar.ApiTestSupport;
import com.calendar.domain.User;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MeApiTest extends ApiTestSupport {
    @Test
    void returnsCurrentUser() throws Exception {
        User user = persistUser("me@example.com", "g-me", "Taro");

        mockMvc.perform(get("/api/me").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("me@example.com"))
                .andExpect(jsonPath("$.name").value("Taro"))
                .andExpect(jsonPath("$.time_zone").value("Asia/Tokyo"))
                .andExpect(jsonPath("$.avatar_url").value(nullValue()));
    }

    @Test
    void updatesTimeZone() throws Exception {
        User user = persistUser("tz@example.com", "g-tz", "Taro");

        mockMvc.perform(patch("/api/me")
                        .header("Authorization", bearer(user))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"time_zone\":\"America/New_York\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.time_zone").value("America/New_York"));
    }

    @Test
    void rejectsUnknownTimeZone() throws Exception {
        User user = persistUser("badtz@example.com", "g-badtz", "Taro");

        mockMvc.perform(patch("/api/me")
                        .header("Authorization", bearer(user))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"time_zone\":\"Not/AZone\"}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }
}
