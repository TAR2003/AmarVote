package com.amarvote.amarvote.model.scheduler;

/**
 * Represents the lifecycle state of a chunk
 * Transitions are monotonic: PENDING -> QUEUED -> PROCESSING -> COMPLETED/FAILED
 */
public enum ChunkState {
    /**
     * Chunk exists but has not yet been queued
     */
    PENDING,
    
    /**
     * Chunk has been published to the queue but not yet processed
     */
    QUEUED,
    
    /**
     * Chunk has been received by a worker and is being processed
     */
    PROCESSING,
    
    /**
     * Chunk has been successfully completed
     */
    COMPLETED,
    
    /**
     * Chunk processing failed with an irrecoverable error
     */
    FAILED
}
