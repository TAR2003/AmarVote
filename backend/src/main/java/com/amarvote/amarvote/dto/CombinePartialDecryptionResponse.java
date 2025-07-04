package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record CombinePartialDecryptionResponse(
    boolean success,
    String message,
    Object results  // This will contain the final election results JSON from ElectionGuard
) {}
