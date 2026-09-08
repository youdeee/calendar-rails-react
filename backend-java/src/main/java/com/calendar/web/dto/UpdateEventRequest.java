package com.calendar.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public class UpdateEventRequest {
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;
    private Boolean allDay;
    private RecurrenceParams recurrence;
    @JsonIgnore
    private boolean recurrenceSpecified;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public void setStartAt(Instant startAt) {
        this.startAt = startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public void setEndAt(Instant endAt) {
        this.endAt = endAt;
    }

    public Boolean getAllDay() {
        return allDay;
    }

    public void setAllDay(Boolean allDay) {
        this.allDay = allDay;
    }

    public RecurrenceParams getRecurrence() {
        return recurrence;
    }

    @JsonProperty("recurrence")
    public void setRecurrence(RecurrenceParams recurrence) {
        this.recurrenceSpecified = true;
        this.recurrence = recurrence;
    }

    public boolean isRecurrenceSpecified() {
        return recurrenceSpecified;
    }
}
