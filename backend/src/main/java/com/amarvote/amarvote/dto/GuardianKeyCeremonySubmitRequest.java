package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GuardianKeyCeremonySubmitRequest(
    @NotNull(message = "Election ID is required")
    Long electionId,

    @NotBlank(message = "Guardian public key is required")
    String guardianPublicKey,

    String guardianKeyBackup
) {}
