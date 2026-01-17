package com.amarvote.amarvote.dto.queue;

import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Message for compensated decryption operations
 * 
 * This message contains information about a single chunk that needs
 * compensated decryption processing.
 * 
 * Flow:
 * 1. Publisher creates one message per (chunk, source_guardian, missing_guardian) combination
 * 2. RabbitMQ routes message to compensated decryption queue
 * 3. Worker picks up message and processes that specific chunk
 * 4. Worker acknowledges message on success or requeues on failure
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompensatedDecryptionMessage {
    
    /**
     * Unique job ID (same for all chunks in this compensated decryption job)
     */
    private UUID jobId;
    
    /**
     * Election center ID (chunk) to process
     */
    private Long chunkId;
    
    /**
     * Election ID
     */
    private Long electionId;
    
    /**
     * Guardian creating compensated shares (the one who is active)
     */
    private Long sourceGuardianId;
    
    /**
     * Guardian who is missing (the one being compensated for)
     */
    private Long missingGuardianId;
    
    /**
     * Operation type (should always be COMPENSATED_DECRYPTION)
     */
    private OperationType operationType;
}
