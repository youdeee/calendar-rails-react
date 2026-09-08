package com.calendar.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface EventRepository {
    Optional<Event> findByIdAndUserId(Long id, Long userId);

    List<Event> findCandidates(Long userId, Instant from, Instant toBoundary);

    Event save(Event event);

    void delete(Event event);
}
