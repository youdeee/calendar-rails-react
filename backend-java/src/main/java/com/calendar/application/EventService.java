package com.calendar.application;

import com.calendar.application.exception.BadRequestException;
import com.calendar.application.exception.NotFoundException;
import com.calendar.application.exception.UnprocessableException;
import com.calendar.domain.Event;
import com.calendar.domain.EventRepository;
import com.calendar.domain.Recurrence;
import com.calendar.domain.RecurrenceExpander;
import com.calendar.domain.User;
import com.calendar.web.dto.CreateEventRequest;
import com.calendar.web.dto.EventResponse;
import com.calendar.web.dto.RecurrenceParams;
import com.calendar.web.dto.UpdateEventRequest;
import com.calendar.web.mapping.EventDtoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EventService {
    private static final int TITLE_MAX = 200;
    private static final int DESCRIPTION_MAX = 5000;
    private static final DateTimeFormatter SPACE_SEPARATED = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final EventRepository eventRepository;
    private final RecurrenceCodec recurrenceCodec;
    private final EventDtoMapper eventDtoMapper;

    @Transactional(readOnly = true)
    public List<EventResponse> list(User user, String fromRaw, String toRaw) {
        Instant from = parseDate(fromRaw);
        Instant to = parseDate(toRaw);
        if (to.isBefore(from)) {
            throw new BadRequestException("to must be after from");
        }
        if (to.isAfter(from.atZone(ZoneOffset.UTC).plusMonths(3).toInstant())) {
            throw new BadRequestException("range too large");
        }
        Instant toBoundary = RecurrenceExpander.endOfUtcDay(to);
        List<EventResponse> occurrences = new ArrayList<>();
        for (Event event : eventRepository.findCandidates(user.getId(), from, toBoundary)) {
            Recurrence recurrence = recurrenceCodec.deserialize(event.getRecurrenceRule());
            Duration duration = Duration.between(event.getStartAt(), event.getEndAt());
            for (Instant start : RecurrenceExpander.occurrencesBetween(event, from, to, recurrence)) {
                occurrences.add(eventDtoMapper.toOccurrence(event, recurrence, start, start.plus(duration)));
            }
        }
        return occurrences;
    }

    @Transactional
    public EventResponse create(User user, CreateEventRequest request) {
        if (request == null) {
            throw new BadRequestException("param is missing or the value is empty: event");
        }
        Event event = new Event();
        event.setUserId(user.getId());
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setStartAt(request.startAt());
        event.setEndAt(request.endAt());
        event.setAllDay(Boolean.TRUE.equals(request.allDay()));
        applyRecurrence(event, true, request.recurrence());
        validate(event);
        Instant now = Instant.now();
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        eventRepository.save(event);
        Recurrence recurrence = recurrenceCodec.deserialize(event.getRecurrenceRule());
        return eventDtoMapper.toResponse(event, recurrence);
    }

    @Transactional
    public EventResponse update(User user, Long id, UpdateEventRequest request) {
        if (request == null) {
            throw new BadRequestException("param is missing or the value is empty: event");
        }
        Event event = eventRepository.findByIdAndUserId(id, user.getId()).orElseThrow(NotFoundException::new);
        if (request.getTitle() != null) {
            event.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            event.setDescription(request.getDescription());
        }
        if (request.getStartAt() != null) {
            event.setStartAt(request.getStartAt());
        }
        if (request.getEndAt() != null) {
            event.setEndAt(request.getEndAt());
        }
        if (request.getAllDay() != null) {
            event.setAllDay(request.getAllDay());
        }
        if (request.isRecurrenceSpecified()) {
            applyRecurrence(event, true, request.getRecurrence());
        }
        validate(event);
        event.setUpdatedAt(Instant.now());
        eventRepository.save(event);
        Recurrence recurrence = recurrenceCodec.deserialize(event.getRecurrenceRule());
        return eventDtoMapper.toResponse(event, recurrence);
    }

    @Transactional
    public void delete(User user, Long id) {
        Event event = eventRepository.findByIdAndUserId(id, user.getId()).orElseThrow(NotFoundException::new);
        eventRepository.delete(event);
    }

    private void applyRecurrence(Event event, boolean specified, RecurrenceParams params) {
        if (!specified) {
            return;
        }
        if (params == null) {
            event.setRecurrenceRule(null);
            return;
        }
        event.setRecurrenceRule(recurrenceCodec.serialize(toRecurrence(params)));
    }

    private Recurrence toRecurrence(RecurrenceParams params) {
        int interval = params.interval() == null ? 0 : params.interval();
        String until = params.until() == null || params.until().isBlank() ? null : params.until();
        Recurrence recurrence = new Recurrence(params.frequency(), interval, until);
        validateRecurrence(recurrence);
        return recurrence;
    }

    private void validate(Event event) {
        List<String> errors = new ArrayList<>();
        if (event.getTitle() == null || event.getTitle().isBlank()) {
            errors.add("Title can't be blank");
        } else if (event.getTitle().length() > TITLE_MAX) {
            errors.add("Title is too long (maximum is " + TITLE_MAX + " characters)");
        }
        if (event.getDescription() != null && event.getDescription().length() > DESCRIPTION_MAX) {
            errors.add("Description is too long (maximum is " + DESCRIPTION_MAX + " characters)");
        }
        if (event.getStartAt() == null) {
            errors.add("Start at can't be blank");
        }
        if (event.getEndAt() == null) {
            errors.add("End at can't be blank");
        }
        if (event.getStartAt() != null && event.getEndAt() != null && !event.getEndAt().isAfter(event.getStartAt())) {
            errors.add("End at must be after start_at");
        }
        if (event.recurring()) {
            validateRecurrence(recurrenceCodec.deserialize(event.getRecurrenceRule()));
        }
        if (!errors.isEmpty()) {
            throw new UnprocessableException(String.join(", ", errors));
        }
    }

    private void validateRecurrence(Recurrence recurrence) {
        List<String> errors = new ArrayList<>();
        if (recurrence.frequency() == null || !Recurrence.ALLOWED_FREQUENCIES.contains(recurrence.frequency())) {
            errors.add("Recurrence rule frequency must be one of daily, weekly, monthly");
        }
        if (recurrence.interval() < 1) {
            errors.add("Recurrence rule interval must be a positive integer");
        }
        if (recurrence.until() != null) {
            try {
                LocalDate.parse(recurrence.until());
            } catch (DateTimeParseException e) {
                errors.add("Recurrence rule until must be a valid date");
            }
        }
        if (!errors.isEmpty()) {
            throw new UnprocessableException(String.join(", ", errors));
        }
    }

    private Instant parseDate(String value) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException("invalid date: " + value);
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            // try other formats below
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ignored) {
            // try other formats below
        }
        try {
            return LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException ignored) {
            // try other formats below
        }
        try {
            return LocalDateTime.parse(value, SPACE_SEPARATED).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            throw new BadRequestException("invalid date: " + value);
        }
    }
}
