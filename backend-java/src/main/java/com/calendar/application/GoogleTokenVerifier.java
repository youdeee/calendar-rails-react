package com.calendar.application;

public interface GoogleTokenVerifier {
    GoogleProfile verify(String idToken);
}
