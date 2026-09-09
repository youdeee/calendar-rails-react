package com.calendar;

import com.calendar.application.GoogleProfile;
import com.calendar.application.GoogleTokenVerifier;
import com.calendar.application.exception.InvalidGoogleTokenException;
import com.calendar.domain.User;
import com.calendar.domain.UserRepository;
import com.calendar.infrastructure.security.JwtService;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class ApiTestSupport {
    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected JsonMapper objectMapper;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected JwtService jwtService;

    @MockitoBean
    protected GoogleTokenVerifier googleTokenVerifier;

    @MockitoBean
    protected JavaMailSender javaMailSender;

    protected void stubGoogleLogin() {
        when(googleTokenVerifier.verify(anyString())).thenReturn(
                new GoogleProfile("google-1", "a@example.com", true, "Taro", "https://example.com/a.png"));
    }

    protected void stubInvalidGoogle() {
        when(googleTokenVerifier.verify(anyString())).thenThrow(new InvalidGoogleTokenException());
    }

    protected User persistUser() {
        String suffix = UUID.randomUUID().toString();
        return persistUser(suffix + "@example.com", "g-" + suffix, "Taro");
    }

    protected User persistUser(String email, String googleUid, String name) {
        User user = new User();
        user.setEmail(email);
        user.setGoogleUid(googleUid);
        user.setName(name);
        user.setTimeZone("Asia/Tokyo");
        Instant now = Instant.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    protected String bearer(User user) {
        return "Bearer " + jwtService.encode(user.getId());
    }

    protected String loginAndRawRefreshToken() throws Exception {
        stubGoogleLogin();
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id_token\":\"valid\"}"))
                .andReturn();
        return result.getResponse().getCookie("refresh_token").getValue();
    }
}
