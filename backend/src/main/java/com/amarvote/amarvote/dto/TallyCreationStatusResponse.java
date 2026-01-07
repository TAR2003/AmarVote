package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TallyCreationStatusResponse {
    private boolean success;
    private String message;
    private String status; // pending, in_progress, completed, failed
    private Integer totalChunks;
    private Integer processedChunks;
    private String createdBy;
    private String startedAt;
    private String completedAt;
    private String errorMessage;
    private Double progressPercentage;
}
