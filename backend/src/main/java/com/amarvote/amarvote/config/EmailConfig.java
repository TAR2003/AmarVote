package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.amarvote.amarvote.email.EmailSender;
import com.amarvote.amarvote.email.ResendEmailSender;
import com.amarvote.amarvote.email.SmtpEmailSender;

@Configuration
public class EmailConfig {

    /**
     * Selects the active email provider.
     * <ul>
     *   <li>{@code auto} (default) — Resend when API key is set, otherwise SMTP/Gmail</li>
     *   <li>{@code resend} — force Resend</li>
     *   <li>{@code smtp} — force SMTP/Gmail</li>
     * </ul>
     */
    @Bean
    public EmailSender emailSender(
            @Value("${email.provider:auto}") String provider,
            ResendEmailSender resendEmailSender,
            SmtpEmailSender smtpEmailSender) {

        String normalized = provider == null ? "auto" : provider.trim().toLowerCase();

        return switch (normalized) {
            case "resend" -> resendEmailSender;
            case "smtp", "gmail", "google" -> smtpEmailSender;
            case "auto" -> resendEmailSender.isConfigured() ? resendEmailSender : smtpEmailSender;
            default -> throw new IllegalArgumentException(
                    "Unknown email.provider value: " + provider + ". Use auto, resend, or smtp.");
        };
    }
}
