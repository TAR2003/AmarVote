package com.amarvote.amarvote.dto.queue;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Response returned when a job is created
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobResponse {
    
    /**
     * Unique job ID for tracking
     */
    private UUID jobId;
    
    /**
     * Total number of chunks to process
     */
    private int totalChunks;
    
    /**
     * Status: QUEUED, IN_PROGRESS, COMPLETED, FAILED
     */
    private String status;
    
    /**
     * Message for user
     */
    private String message;
    
    /**
     * URL to poll for progress updates
     */
    private String pollUrl;
    
    /**
     * When the job was created
     */
    private Instant createdAt;
    
    /**
     * Success flag
     */
    private boolean success;
}
