package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Metadata stored with Redis lock to track who initiated a process and when
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LockMetadata {
    /**
     * Email of the user who initiated the task
     */
    private String userEmail;
    
    /**
     * Timestamp when the process started
     */
    private Instant startTime;
    
    /**
     * Timestamp when the process is expected to end (optional)
     */
    private Instant expectedEndTime;
    
    /**
     * Type of operation (e.g., "TALLY_CREATION", "GUARDIAN_DECRYPTION", "COMBINE_DECRYPTION")
     */
    private String operationType;
    
    /**
     * Unique identifier for this lock (e.g., "election:123:guardian:1:decrypt")
     */
    private String lockKey;
    
    /**
     * Additional context information
     */
    private String context;
}
