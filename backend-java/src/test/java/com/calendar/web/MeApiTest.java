package com.calendar.web;

import com.calendar.ApiTestSupport;
import com.calendar.domain.User;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
                .andExpect(jsonPath("$.avatar_url").value(nullValue()));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }
}
