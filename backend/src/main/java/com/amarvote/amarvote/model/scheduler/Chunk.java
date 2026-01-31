package com.amarvote.amarvote.model.scheduler;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Represents a single chunk - the smallest independently executable unit of work
 * A chunk belongs to exactly one task instance
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Chunk {
    /**
     * Unique identifier for this chunk
     */
    private String chunkId;
    
    /**
     * Task instance this chunk belongs to
     */
    private String taskInstanceId;
    
    /**
     * Chunk number within the task instance (1-based)
     */
    private int chunkNumber;
    
    /**
     * Current state of the chunk
     */
    @Builder.Default
    private ChunkState state = ChunkState.PENDING;
    
    /**
     * Serialized task data (JSON string containing all necessary data for execution)
     */
    private String taskData;
    
    /**
     * Timestamp when chunk was created
     */
    @Builder.Default
    private Instant createdAt = Instant.now();
    
    /**
     * Timestamp when chunk was queued
     */
    private Instant queuedAt;
    
    /**
     * Timestamp when chunk processing started
     */
    private Instant processingStartedAt;
    
    /**
     * Timestamp when chunk completed or failed
     */
    private Instant completedAt;
    
    /**
     * Number of times this chunk has been attempted
     */
    @Builder.Default
    private int attemptCount = 0;
    
    /**
     * Error message if chunk failed
     */
    private String errorMessage;
    
    /**
     * Check if chunk can be queued
     */
    public boolean canBeQueued() {
        return state == ChunkState.PENDING || state == ChunkState.FAILED;
    }
    
    /**
     * Check if chunk is active (not yet completed)
     */
    public boolean isActive() {
        return state != ChunkState.COMPLETED && state != ChunkState.FAILED;
    }
}
