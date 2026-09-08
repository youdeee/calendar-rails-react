package com.calendar.infrastructure.persistence;

import com.calendar.domain.Event;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;
import java.util.List;

@Mapper
public interface EventMapper {
    Event findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    List<Event> findCandidates(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("toBoundary") Instant toBoundary);

    int insert(Event event);

    int update(Event event);

    int delete(@Param("id") Long id, @Param("userId") Long userId);
}
