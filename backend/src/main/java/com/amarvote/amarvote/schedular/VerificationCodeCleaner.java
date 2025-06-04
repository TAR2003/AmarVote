package com.amarvote.amarvote.schedular;

import org.springframework.scheduling.annotation.Scheduled;

import com.amarvote.amarvote.service.VerificationCodeService;
import org.springframework.stereotype.Component;

@Component
public class VerificationCodeCleaner {
    private final VerificationCodeService codeService;

    public VerificationCodeCleaner(VerificationCodeService codeService) {
        this.codeService = codeService;
    }

    @Scheduled(fixedRate = 3600000) // every hour
    public void cleanExpiredCodes() {
        System.out.println("Running scheduled task to clean expired verification codes");
        codeService.deleteExpiredCodes();
    }
}
