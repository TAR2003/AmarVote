package com.amarvote.amarvote.dto;

import java.time.Instant;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElectionProgressEvent {
    private Long electionId;
    private String eventType;
    private String operation;
    private Long guardianId;
    private Integer chunkNumber;
    private String status;
    private Map<String, Object> payload;
    @Builder.Default
    private Instant timestamp = Instant.now();
}
