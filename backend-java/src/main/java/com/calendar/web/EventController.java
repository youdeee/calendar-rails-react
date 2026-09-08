package com.calendar.web;

import com.calendar.application.EventService;
import com.calendar.application.exception.BadRequestException;
import com.calendar.domain.User;
import com.calendar.web.dto.CreateEventBody;
import com.calendar.web.dto.EventResponse;
import com.calendar.web.dto.UpdateEventBody;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {
    private final EventService eventService;

    @GetMapping
    public List<EventResponse> index(
            @AuthenticationPrincipal User user,
            @RequestParam String from,
            @RequestParam String to
    ) {
        return eventService.list(user, from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(@AuthenticationPrincipal User user, @RequestBody CreateEventBody body) {
        if (body == null || body.event() == null) {
            throw new BadRequestException("param is missing or the value is empty: event");
        }
        return eventService.create(user, body.event());
    }

    @PatchMapping("/{id}")
    public EventResponse update(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody UpdateEventBody body
    ) {
        if (body == null || body.event() == null) {
            throw new BadRequestException("param is missing or the value is empty: event");
        }
        return eventService.update(user, id, body.event());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        eventService.delete(user, id);
    }
}
