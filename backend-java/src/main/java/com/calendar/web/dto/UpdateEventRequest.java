package com.calendar.web.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.time.Instant;
import java.time.LocalDate;

public class UpdateEventRequest {
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;
    private LocalDate startOn;
    private LocalDate endOn;
    private Boolean allDay;
    private Integer reminderMinutes;
    private RecurrenceParams recurrence;
    @JsonIgnore
    private boolean recurrenceSpecified;
    @JsonIgnore
    private boolean reminderMinutesSpecified;

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

    public LocalDate getStartOn() {
        return startOn;
    }

    public void setStartOn(LocalDate startOn) {
        this.startOn = startOn;
    }

    public LocalDate getEndOn() {
        return endOn;
    }

    public void setEndOn(LocalDate endOn) {
        this.endOn = endOn;
    }

    public Boolean getAllDay() {
        return allDay;
    }

    public void setAllDay(Boolean allDay) {
        this.allDay = allDay;
    }

    public Integer getReminderMinutes() {
        return reminderMinutes;
    }

    @JsonProperty("reminder_minutes")
    @JsonDeserialize(using = FlexibleIntDeserializer.class)
    public void setReminderMinutes(Integer reminderMinutes) {
        this.reminderMinutesSpecified = true;
        this.reminderMinutes = reminderMinutes;
    }

    public boolean isReminderMinutesSpecified() {
        return reminderMinutesSpecified;
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
