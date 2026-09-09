package com.calendar.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EventRepository {
    Optional<Event> findById(Long id);

    Optional<Event> findByIdAndUserId(Long id, Long userId);

    List<Event> findCandidates(Long userId, Instant from, Instant toBoundary, LocalDate zoneStartDate, LocalDate zoneEndDate);

    List<Event> findWithReminders(Long eventId);

    Event save(Event event);

    void delete(Event event);
}
