package com.amarvote.amarvote.schedular;

import com.amarvote.amarvote.service.PasswordResetTokenService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PasswordResetTokenCleaner {

    private final PasswordResetTokenService tokenService;

    public PasswordResetTokenCleaner(PasswordResetTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Scheduled(fixedRate = 3600000) // every hour
    public void cleanExpiredTokens() {
        System.out.println("Running scheduled task to clean expired password reset tokens");
        tokenService.deleteExpiredTokens();
    }
}
