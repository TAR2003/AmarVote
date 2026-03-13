package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GuardianKeyCeremonySubmitRequest(
    @NotNull(message = "Election ID is required")
    Long electionId,

    @NotBlank(message = "Guardian public key is required")
    String guardianPublicKey,

    @NotBlank(message = "Guardian private key is required")
    String guardianPrivateKey,

    @NotBlank(message = "Guardian polynomial is required")
    String guardianPolynomial,

    String guardianKeyBackup,

    @NotBlank(message = "Local encryption password is required")
    String localEncryptionPassword
) {}
