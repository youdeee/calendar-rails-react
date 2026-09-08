package com.calendar;

import com.calendar.application.GoogleTokenVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class BackendApplicationTests {
    @MockitoBean
    GoogleTokenVerifier googleTokenVerifier;

    @Test
    void contextLoads() {
    }
}
