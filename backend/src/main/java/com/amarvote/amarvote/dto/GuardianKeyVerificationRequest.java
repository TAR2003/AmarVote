package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;

public record GuardianKeyVerificationRequest(
    @NotBlank(message = "Encrypted credential data is required")
    String encryptedCredential
) {}
