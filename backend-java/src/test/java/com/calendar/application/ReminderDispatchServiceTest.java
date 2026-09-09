package com.calendar.application;

import com.calendar.ApiTestSupport;
import com.calendar.domain.Event;
import com.calendar.domain.EventRepository;
import com.calendar.domain.User;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReminderDispatchServiceTest extends ApiTestSupport {
    @Autowired
    ReminderDispatchService reminderDispatchService;

    @Autowired
    EventRepository eventRepository;

    @BeforeEach
    void stubMail() {
        when(javaMailSender.createMimeMessage())
                .thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
    }

    @Test
    void sendsOneEmailFifteenMinutesBeforeTimedEvent() {
        User user = persistUser();
        Event event = timed(user, "Lunch", Instant.parse("2026-09-10T06:00:00Z"), Instant.parse("2026-09-10T07:00:00Z"), 15);
        eventRepository.save(event);

        reminderDispatchService.dispatch(event.getId(), Instant.parse("2026-09-10T05:45:00Z"));

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender).send(captor.capture());
        assertEquals("リマインダー: Lunch", subject(captor.getValue()));
    }

    @Test
    void sendsAllDayReminderTheDayBeforeAtEighteen() {
        User user = persistUser();
        Event event = allDay(user, "Holiday", LocalDate.of(2026, 9, 10), 360);
        eventRepository.save(event);

        reminderDispatchService.dispatch(event.getId(), Instant.parse("2026-09-09T09:00:00Z"));

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender).send(captor.capture());
        assertEquals("リマインダー: Holiday", subject(captor.getValue()));
    }

    @Test
    void doesNotSendTwiceForTheSameOccurrence() {
        User user = persistUser();
        Event event = timed(user, "Lunch", Instant.parse("2026-09-10T06:00:00Z"), Instant.parse("2026-09-10T07:00:00Z"), 15);
        eventRepository.save(event);
        Instant now = Instant.parse("2026-09-10T05:45:00Z");

        reminderDispatchService.dispatch(event.getId(), now);
        reminderDispatchService.dispatch(event.getId(), now);

        verify(javaMailSender, times(1)).send(any(MimeMessage.class));
    }

    @Test
    void doesNotSendWhenReminderMinutesIsBlank() {
        User user = persistUser();
        Event event = timed(user, "Lunch", Instant.parse("2026-09-10T06:00:00Z"), Instant.parse("2026-09-10T07:00:00Z"), null);
        eventRepository.save(event);

        reminderDispatchService.dispatch(event.getId(), Instant.parse("2026-09-10T05:45:00Z"));

        verify(javaMailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void doesNotSendAfterStartPlusTwoHours() {
        User user = persistUser();
        Event event = timed(user, "Lunch", Instant.parse("2026-09-10T06:00:00Z"), Instant.parse("2026-09-10T07:00:00Z"), 15);
        eventRepository.save(event);

        reminderDispatchService.dispatch(event.getId(), Instant.parse("2026-09-10T09:00:00Z"));

        verify(javaMailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void stillSendsLateReminderWhenEventIsInTheFuture() {
        User user = persistUser();
        Event event = timed(user, "Lunch", Instant.parse("2026-10-10T06:00:00Z"), Instant.parse("2026-10-10T07:00:00Z"), 43_200);
        eventRepository.save(event);

        reminderDispatchService.dispatch(event.getId(), Instant.parse("2026-09-10T11:00:00Z"));

        verify(javaMailSender).send(any(MimeMessage.class));
    }

    @Test
    void doesNotSendAllDayReminderOnTheMorningOfTheEvent() {
        User user = persistUser();
        Event event = allDay(user, "Holiday", LocalDate.of(2026, 9, 10), 360);
        eventRepository.save(event);

        reminderDispatchService.dispatch(event.getId(), Instant.parse("2026-09-10T00:00:00Z"));

        verify(javaMailSender, never()).send(any(MimeMessage.class));
    }

    private static String subject(MimeMessage message) {
        try {
            return message.getSubject();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static Event timed(User user, String title, Instant start, Instant end, Integer reminderMinutes) {
        Event event = new Event();
        event.setUserId(user.getId());
        event.setTitle(title);
        event.setStartAt(start);
        event.setEndAt(end);
        event.setReminderMinutes(reminderMinutes);
        Instant now = Instant.now();
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        return event;
    }

    private static Event allDay(User user, String title, LocalDate on, int reminderMinutes) {
        Event event = new Event();
        event.setUserId(user.getId());
        event.setTitle(title);
        event.setAllDay(true);
        event.setStartOn(on);
        event.setEndOn(on);
        event.setReminderMinutes(reminderMinutes);
        Instant now = Instant.now();
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        return event;
    }
}
