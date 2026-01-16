package com.amarvote.amarvote.dto.queue;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Response for job status polling
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobStatusResponse {
    
    /**
     * Job ID
     */
    private UUID jobId;
    
    /**
     * Status: QUEUED, IN_PROGRESS, COMPLETED, FAILED
     */
    private String status;
    
    /**
     * Total number of chunks
     */
    private int totalChunks;
    
    /**
     * Number of chunks processed successfully
     */
    private int processedChunks;
    
    /**
     * Number of chunks that failed
     */
    private int failedChunks;
    
    /**
     * Progress percentage (0-100)
     */
    private double progressPercent;
    
    /**
     * When the job started
     */
    private Instant startedAt;
    
    /**
     * When the job completed (null if still running)
     */
    private Instant completedAt;
    
    /**
     * Error message (if failed)
     */
    private String errorMessage;
    
    /**
     * Operation type
     */
    private String operationType;
    
    /**
     * Election ID
     */
    private Long electionId;
}
