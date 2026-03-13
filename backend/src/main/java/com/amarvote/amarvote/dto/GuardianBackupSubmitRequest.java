package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GuardianBackupSubmitRequest(
    @NotNull(message = "Election ID is required")
    Long electionId,

    @NotBlank(message = "Guardian key backup payload is required")
    String guardianKeyBackup
) {}
