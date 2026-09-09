package com.calendar.web.mapping;

import com.calendar.domain.Event;
import com.calendar.domain.Recurrence;
import com.calendar.web.dto.EventResponse;
import com.calendar.web.dto.RecurrenceParams;
import org.mapstruct.Mapper;

import java.time.Instant;
import java.time.LocalDate;

@Mapper(componentModel = "spring")
public interface EventDtoMapper {
    RecurrenceParams toParams(Recurrence recurrence);

    default EventResponse toResponse(Event event, Recurrence recurrence) {
        if (event.isAllDay()) {
            return toAllDayOccurrence(event, recurrence, event.getStartOn(), event.getEndOn());
        }
        return toOccurrence(event, recurrence, event.getStartAt(), event.getEndAt());
    }

    default EventResponse toOccurrence(Event event, Recurrence recurrence, Instant startAt, Instant endAt) {
        return new EventResponse(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                startAt,
                endAt,
                null,
                null,
                event.isAllDay(),
                event.getReminderMinutes(),
                recurrence != null,
                toParams(recurrence)
        );
    }

    default EventResponse toAllDayOccurrence(Event event, Recurrence recurrence, LocalDate startOn, LocalDate endOn) {
        return new EventResponse(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                null,
                null,
                startOn,
                endOn,
                event.isAllDay(),
                event.getReminderMinutes(),
                recurrence != null,
                toParams(recurrence)
        );
    }
}
