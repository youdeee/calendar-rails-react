package com.calendar.web;

import com.calendar.ApiTestSupport;
import com.calendar.domain.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EventApiTest extends ApiTestSupport {
    private User user;
    private User other;
    private String auth;

    @BeforeEach
    void setUp() {
        user = persistUser();
        other = persistUser();
        other.setName("Jiro");
        userRepository.save(other);
        auth = bearer(user);
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/events").param("from", "2026-08-01").param("to", "2026-08-31"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listsEventsInRange() throws Exception {
        createEvent(user, "In range", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);
        createEvent(user, "Out of range", "2026-09-10T10:00:00Z", "2026-09-10T11:00:00Z", null);

        mockMvc.perform(get("/api/events").param("from", "2026-08-01").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("In range"));
    }

    @Test
    void excludesOtherUsersEvents() throws Exception {
        createEvent(other, "Not mine", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);

        mockMvc.perform(get("/api/events").param("from", "2026-08-01").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void expandsWeeklyRecurringEvent() throws Exception {
        MvcResult created = createEvent(user, "Standup", "2026-08-03T10:00:00Z", "2026-08-03T10:15:00Z",
                "{\"frequency\":\"weekly\",\"interval\":1}");
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/events").param("from", "2026-08-01").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].recurring").value(true))
                .andExpect(jsonPath("$[0].recurrence.frequency").value("weekly"))
                .andExpect(jsonPath("$[0].recurrence.interval").value(1));
    }

    @Test
    void includesEventLaterInToDay() throws Exception {
        createEvent(user, "Evening", "2026-08-31T22:00:00Z", "2026-08-31T23:00:00Z", null);

        mockMvc.perform(get("/api/events").param("from", "2026-08-01").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Evening"));
    }

    @Test
    void rejectsInvalidDate() throws Exception {
        mockMvc.perform(get("/api/events").param("from", "not-a-date").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsRangeOverThreeMonths() throws Exception {
        mockMvc.perform(get("/api/events").param("from", "2026-01-01").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createsNonRecurringEvent() throws Exception {
        mockMvc.perform(post("/api/events")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00"}}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Lunch"))
                .andExpect(jsonPath("$.recurring").value(false));
    }

    @Test
    void createsRecurringEvent() throws Exception {
        mockMvc.perform(post("/api/events")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"title":"Standup","start_at":"2026-08-03T10:00:00+09:00","end_at":"2026-08-03T10:15:00+09:00","recurrence":{"frequency":"weekly","interval":"1","until":"2026-12-31"}}}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recurring").value(true))
                .andExpect(jsonPath("$.recurrence.frequency").value("weekly"))
                .andExpect(jsonPath("$.recurrence.interval").value(1))
                .andExpect(jsonPath("$.recurrence.until").value("2026-12-31"));
    }

    @Test
    void rejectsInvalidFrequency() throws Exception {
        mockMvc.perform(post("/api/events")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"title":"Bad","start_at":"2026-08-03T10:00:00+09:00","end_at":"2026-08-03T10:15:00+09:00","recurrence":{"frequency":"yearly","interval":"1"}}}
                                """))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void rejectsLongTitle() throws Exception {
        mockMvc.perform(post("/api/events")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"event\":{\"title\":\"" + "a".repeat(201)
                                + "\",\"start_at\":\"2026-08-10T12:00:00+09:00\",\"end_at\":\"2026-08-10T13:00:00+09:00\"}}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void createRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00"}}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsNonObjectRecurrence() throws Exception {
        mockMvc.perform(post("/api/events")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"title":"Lunch","start_at":"2026-08-10T12:00:00+09:00","end_at":"2026-08-10T13:00:00+09:00","recurrence":"not-a-hash"}}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsInvalidUntil() throws Exception {
        mockMvc.perform(post("/api/events")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"title":"Bad until","start_at":"2026-08-03T10:00:00+09:00","end_at":"2026-08-03T10:15:00+09:00","recurrence":{"frequency":"weekly","interval":"1","until":"not-a-date"}}}
                                """))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void updatesEventTimes() throws Exception {
        MvcResult created = createEvent(user, "Meeting", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/events/" + id)
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"start_at":"2026-08-11T10:00:00+09:00","end_at":"2026-08-11T11:00:00+09:00"}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.start_at", org.hamcrest.Matchers.startsWith("2026-08-11T01:00:00")))
                .andExpect(jsonPath("$.end_at", org.hamcrest.Matchers.startsWith("2026-08-11T02:00:00")));
    }

    @Test
    void updatesRecurrence() throws Exception {
        MvcResult created = createEvent(user, "Standup", "2026-08-03T10:00:00Z", "2026-08-03T10:15:00Z",
                "{\"frequency\":\"weekly\",\"interval\":1}");
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/events/" + id)
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"event":{"recurrence":{"frequency":"weekly","interval":"2","until":"2026-12-31"}}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recurrence.interval").value(2))
                .andExpect(jsonPath("$.recurrence.until").value("2026-12-31"));
    }

    @Test
    void updateRejectsBlankTitle() throws Exception {
        MvcResult created = createEvent(user, "Meeting", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/events/" + id)
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"event\":{\"title\":\"\"}}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void cannotUpdateOtherUsersEvent() throws Exception {
        MvcResult created = createEvent(other, "Not mine", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/events/" + id)
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"event\":{\"title\":\"Hijacked\"}}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletesOwnEvent() throws Exception {
        MvcResult created = createEvent(user, "Meeting", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/events/" + id).header("Authorization", auth))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/events").param("from", "2026-08-01").param("to", "2026-08-31").header("Authorization", auth))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void cannotDeleteOtherUsersEvent() throws Exception {
        MvcResult created = createEvent(other, "Not mine", "2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z", null);
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/events/" + id).header("Authorization", auth))
                .andExpect(status().isNotFound());
    }

    private MvcResult createEvent(User owner, String title, String start, String end, String recurrenceJson) throws Exception {
        String recurrence = recurrenceJson == null ? "" : ",\"recurrence\":" + recurrenceJson;
        return mockMvc.perform(post("/api/events")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"event\":{\"title\":\"" + title + "\",\"start_at\":\"" + start
                                + "\",\"end_at\":\"" + end + "\"" + recurrence + "}}"))
                .andExpect(status().isCreated())
                .andReturn();
    }
}
