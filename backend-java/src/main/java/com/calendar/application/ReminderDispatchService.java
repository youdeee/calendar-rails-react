package com.calendar.application;

import com.calendar.domain.Event;
import com.calendar.domain.EventRepository;
import com.calendar.domain.Recurrence;
import com.calendar.domain.RecurrenceExpander;
import com.calendar.domain.ReminderDelivery;
import com.calendar.domain.User;
import com.calendar.domain.UserRepository;
import com.calendar.infrastructure.persistence.ReminderDeliveryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class ReminderDispatchService {
    static final Duration STALE_AFTER = Duration.ofHours(2);

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final ReminderDeliveryMapper reminderDeliveryMapper;
    private final EventReminderMailer mailer;
    private final RecurrenceCodec recurrenceCodec;
    private final Clock clock;

    @Scheduled(cron = "0 * * * * *")
    public void sweep() {
        dispatch(null, clock.instant());
    }

    public void dispatchAfterSave(Event event) {
        if (event.getReminderMinutes() == null) {
            return;
        }
        dispatch(event.getId(), clock.instant());
    }

    @Transactional
    public void dispatch(Long eventId, Instant now) {
        for (Event event : eventRepository.findWithReminders(eventId)) {
            User user = userRepository.findById(event.getUserId()).orElse(null);
            if (user == null) {
                continue;
            }
            dispatchEvent(event, user, now);
        }
    }

    private void dispatchEvent(Event event, User user, Instant now) {
        Instant windowStart = now.minus(STALE_AFTER);
        Instant windowEnd = now.plus(Duration.ofMinutes(event.getReminderMinutes()));
        Recurrence recurrence = recurrenceCodec.deserialize(event.getRecurrenceRule());
        ZoneId zone = EventService.zoneOf(user);
        if (event.isAllDay()) {
            for (LocalDate occurrenceOn : RecurrenceExpander.allDayOccurrencesBetween(event, windowStart, windowEnd, zone, recurrence)) {
                deliverAllDay(event, user, occurrenceOn, now, zone);
            }
        } else {
            for (Instant occurrenceStart : RecurrenceExpander.occurrencesBetween(event, windowStart, windowEnd, recurrence)) {
                deliverTimed(event, user, occurrenceStart, now);
            }
        }
    }

    private void deliverTimed(Event event, User user, Instant occurrenceStart, Instant now) {
        Instant dueAt = occurrenceStart.minus(Duration.ofMinutes(event.getReminderMinutes()));
        if (!due(dueAt, occurrenceStart, now)) {
            return;
        }
        sendOnce(event, user, occurrenceStart, () -> mailer.send(user, event, occurrenceStart, null));
    }

    private void deliverAllDay(Event event, User user, LocalDate occurrenceOn, Instant now, ZoneId zone) {
        Instant startInstant = event.allDayStartInstant(occurrenceOn, zone);
        Instant dueAt = startInstant.minus(Duration.ofMinutes(event.getReminderMinutes()));
        if (!due(dueAt, startInstant, now)) {
            return;
        }
        Instant marker = occurrenceOn.atStartOfDay(ZoneOffset.UTC).toInstant();
        sendOnce(event, user, marker, () -> mailer.send(user, event, null, occurrenceOn));
    }

    private static boolean due(Instant dueAt, Instant startInstant, Instant now) {
        return !dueAt.isAfter(now) && startInstant.isAfter(now.minus(STALE_AFTER));
    }

    private void sendOnce(Event event, User user, Instant occurrenceStartAt, Runnable send) {
        ReminderDelivery existing = reminderDeliveryMapper.findByEventAndOccurrence(event.getId(), occurrenceStartAt);
        if (existing != null && existing.getDeliveredAt() != null) {
            return;
        }
        if (existing == null) {
            Instant now = clock.instant();
            ReminderDelivery row = new ReminderDelivery();
            row.setUserId(user.getId());
            row.setEventId(event.getId());
            row.setOccurrenceStartAt(occurrenceStartAt);
            row.setCreatedAt(now);
            row.setUpdatedAt(now);
            reminderDeliveryMapper.insertIgnore(row);
            existing = reminderDeliveryMapper.findByEventAndOccurrence(event.getId(), occurrenceStartAt);
        }
        if (existing == null || existing.getDeliveredAt() != null) {
            return;
        }
        send.run();
        reminderDeliveryMapper.markDelivered(existing.getId(), clock.instant());
    }
}
