package com.calendar.application;

public record GoogleProfile(String googleUid, String email, boolean emailVerified, String name, String picture) {
}
