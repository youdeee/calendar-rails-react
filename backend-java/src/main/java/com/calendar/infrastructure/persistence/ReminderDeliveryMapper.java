package com.calendar.infrastructure.persistence;

import com.calendar.domain.ReminderDelivery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;

@Mapper
public interface ReminderDeliveryMapper {
    ReminderDelivery findByEventAndOccurrence(
            @Param("eventId") Long eventId,
            @Param("occurrenceStartAt") Instant occurrenceStartAt);

    int insertIgnore(ReminderDelivery delivery);

    int markDelivered(@Param("id") Long id, @Param("deliveredAt") Instant deliveredAt);
}
