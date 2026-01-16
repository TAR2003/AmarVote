package com.amarvote.amarvote.dto.queue;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

/**
 * Message sent to RabbitMQ for processing chunks
 * Each message represents ONE chunk to be processed by a worker
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChunkMessage implements Serializable {
    
    /**
     * Unique job ID that groups all chunks together
     */
    private UUID jobId;
    
    /**
     * ID of the chunk to process (e.g., ElectionCenter ID or Guardian ID)
     */
    private Long chunkId;
    
    /**
     * Type of operation: TALLY, DECRYPTION, COMBINE, COMPENSATED_DECRYPTION
     */
    private OperationType operationType;
    
    /**
     * Election ID for context
     */
    private Long electionId;
    
    /**
     * Guardian ID (for decryption operations)
     */
    private Long guardianId;
    
    /**
     * Additional metadata (optional)
     */
    private String metadata;
    
    /**
     * Retry count (incremented on failure)
     */
    private int retryCount = 0;
}
