package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record CreatePartialDecryptionRequest(
    @NotNull(message = "Election ID is required")
    Long election_id,
    
    @NotNull(message = "Key is required")
    String key
) {}
