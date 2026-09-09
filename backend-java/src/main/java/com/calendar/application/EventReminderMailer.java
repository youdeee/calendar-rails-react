package com.calendar.application;

import com.calendar.domain.Event;
import com.calendar.domain.User;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class EventReminderMailer {
    private final JavaMailSender mailSender;
    private final Clock clock;

    public void send(User user, Event event, Instant occurrenceStartAt, LocalDate occurrenceOn) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom("calendar@localhost");
            helper.setTo(user.getEmail());
            helper.setSubject("リマインダー: " + event.getTitle());
            helper.setText(plainBody(event, occurrenceStartAt, occurrenceOn), false);
            Instant now = clock.instant();
            helper.addAttachment(
                    "event.ics",
                    new ByteArrayResource(EventIcs.body(event, occurrenceStartAt, occurrenceOn, now).getBytes(StandardCharsets.UTF_8)),
                    "text/calendar"
            );
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new IllegalStateException("Failed to send reminder mail", e);
        }
    }

    private static String plainBody(Event event, Instant occurrenceStartAt, LocalDate occurrenceOn) {
        if (event.isAllDay()) {
            return event.getTitle() + "\n終日: " + occurrenceOn;
        }
        return event.getTitle() + "\n開始: " + occurrenceStartAt;
    }
}
