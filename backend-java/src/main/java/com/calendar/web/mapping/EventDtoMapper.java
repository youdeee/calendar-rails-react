package com.calendar.web.mapping;

import com.calendar.domain.Event;
import com.calendar.domain.Recurrence;
import com.calendar.web.dto.EventResponse;
import com.calendar.web.dto.RecurrenceParams;
import org.mapstruct.Mapper;

import java.time.Instant;

@Mapper(componentModel = "spring")
public interface EventDtoMapper {
    RecurrenceParams toParams(Recurrence recurrence);

    default EventResponse toResponse(Event event, Recurrence recurrence) {
        return toOccurrence(event, recurrence, event.getStartAt(), event.getEndAt());
    }

    default EventResponse toOccurrence(Event event, Recurrence recurrence, Instant startAt, Instant endAt) {
        return new EventResponse(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                startAt,
                endAt,
                event.isAllDay(),
                recurrence != null,
                toParams(recurrence)
        );
    }
}
