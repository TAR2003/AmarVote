package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record CombinePartialDecryptionRequest(
    @NotNull(message = "Election ID is required")
    Long election_id
) {}
