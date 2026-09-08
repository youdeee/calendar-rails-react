package com.calendar.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@EqualsAndHashCode(of = "id")
public class User {
    private Long id;
    private String email;
    private String googleUid;
    private String name;
    private String avatarUrl;
    private Instant createdAt;
    private Instant updatedAt;
}
