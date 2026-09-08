package com.calendar.web;

import com.calendar.domain.User;
import com.calendar.web.dto.UserResponse;
import com.calendar.web.mapping.UserDtoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {
    private final UserDtoMapper userDtoMapper;

    @GetMapping
    public UserResponse me(@AuthenticationPrincipal User user) {
        return userDtoMapper.toResponse(user);
    }
}
