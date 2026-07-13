package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Finalizes Round 1 after the guardian has downloaded their credential file.
 * {@code credentials} must be the encryption metadata returned by the prepare step
 * so the downloaded file remains decryptable.
 */
public record GuardianKeyCeremonyConfirmRequest(
    @NotNull(message = "Election ID is required")
    Long electionId,

    @NotBlank(message = "Guardian public key is required")
    String guardianPublicKey,

    @NotBlank(message = "Credential encryption metadata is required")
    String credentials,

    String guardianKeyBackup
) {}
