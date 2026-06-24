package com.amarvote.amarvote.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.repository.AppUserRepository;
import com.amarvote.amarvote.repository.AuthorizedUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserStatsService {

    private static final int ACTIVE_USER_WINDOW_MINUTES = 30;

    private final AppUserRepository appUserRepository;
    private final AuthorizedUserRepository authorizedUserRepository;

    @Transactional(readOnly = true)
    public Map<String, Long> getUserStats() {
        Instant activeSince = Instant.now().minus(ACTIVE_USER_WINDOW_MINUTES, ChronoUnit.MINUTES);
        long registeredUsers = appUserRepository.count();
        long activeUsers = authorizedUserRepository.countActiveRegisteredUsersSince(activeSince);

        return Map.of(
                "registeredUsers", registeredUsers,
                "activeUsers", activeUsers);
    }
}
