package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.amarvote.amarvote.service.AuthorizedUserService;
import com.amarvote.amarvote.service.SystemSettingService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthorizedUserBootstrap {

    @Value("${ADMIN_EMAILS:}")
    private String adminEmails;

    private final AuthorizedUserService authorizedUserService;
    private final SystemSettingService systemSettingService;

    @EventListener(ApplicationReadyEvent.class)
    public void initializeAuthorizedUsers() {
        systemSettingService.ensureDefaults();
        authorizedUserService.bootstrapAuthorizedUsers(adminEmails);
        if (adminEmails == null || adminEmails.isBlank()) {
            log.warn("ADMIN_EMAILS is empty. No startup admin entries were seeded.");
        } else {
            log.info("Authorized users bootstrap completed using ADMIN_EMAILS");
        }
    }
}