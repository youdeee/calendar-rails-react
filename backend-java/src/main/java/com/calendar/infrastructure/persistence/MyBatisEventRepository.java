package com.calendar.infrastructure.persistence;

import com.calendar.domain.Event;
import com.calendar.domain.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class MyBatisEventRepository implements EventRepository {
    private final EventMapper mapper;

    @Override
    public Optional<Event> findById(Long id) {
        return Optional.ofNullable(mapper.findById(id));
    }

    @Override
    public Optional<Event> findByIdAndUserId(Long id, Long userId) {
        return Optional.ofNullable(mapper.findByIdAndUserId(id, userId));
    }

    @Override
    public List<Event> findCandidates(Long userId, Instant from, Instant toBoundary, LocalDate zoneStartDate, LocalDate zoneEndDate) {
        return mapper.findCandidates(userId, from, toBoundary, zoneStartDate, zoneEndDate);
    }

    @Override
    public List<Event> findWithReminders(Long eventId) {
        return mapper.findWithReminders(eventId);
    }

    @Override
    public Event save(Event event) {
        if (event.getId() == null) {
            mapper.insert(event);
        } else {
            mapper.update(event);
        }
        return event;
    }

    @Override
    public void delete(Event event) {
        mapper.delete(event.getId(), event.getUserId());
    }
}
