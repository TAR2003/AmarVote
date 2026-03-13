package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;

public record GenerateGuardianBackupRequest(
    @NotBlank(message = "Encrypted credential data is required")
    String encrypted_data
) {}
