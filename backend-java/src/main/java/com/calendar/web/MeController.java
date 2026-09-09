package com.calendar.web;

import com.calendar.application.exception.BadRequestException;
import com.calendar.application.exception.UnprocessableException;
import com.calendar.domain.User;
import com.calendar.domain.UserRepository;
import com.calendar.web.dto.UpdateMeRequest;
import com.calendar.web.dto.UserResponse;
import com.calendar.web.mapping.UserDtoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {
    private final UserDtoMapper userDtoMapper;
    private final UserRepository userRepository;

    @GetMapping
    public UserResponse me(@AuthenticationPrincipal User user) {
        return userDtoMapper.toResponse(user);
    }

    @PatchMapping
    public UserResponse update(@AuthenticationPrincipal User user, @RequestBody UpdateMeRequest body) {
        if (body == null || body.timeZone() == null || body.timeZone().isBlank()) {
            throw new BadRequestException("param is missing or the value is empty: time_zone");
        }
        try {
            ZoneId.of(body.timeZone());
        } catch (DateTimeException e) {
            throw new UnprocessableException("Time zone is not a valid time zone");
        }
        user.setTimeZone(body.timeZone());
        user.setUpdatedAt(Instant.now());
        return userDtoMapper.toResponse(userRepository.save(user));
    }
}
