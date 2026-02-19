package com.amarvote.amarvote.dto;

import java.time.Instant;

import lombok.Builder;

@Builder
public record CombineStatusResponse(
    boolean success,
    String status,
    String message,
    Integer totalChunks,
    Integer processedChunks,
    Double progressPercentage,
    String createdBy,
    Instant startedAt,
    Instant completedAt,
    String errorMessage,
    // Lock metadata - shows who initiated the operation
    String lockHeldBy,
    Instant lockStartTime,
    Boolean isLocked
) {
    public static CombineStatusResponse notFound() {
        return CombineStatusResponse.builder()
            .success(false)
            .status("not_found")
            .message("No combine operation found for this election")
            .totalChunks(0)
            .processedChunks(0)
            .progressPercentage(0.0)
            .build();
    }
}
