package com.amarvote.amarvote.model.scheduler;

/**
 * Represents the four cryptographic task types in the system
 * All task types MUST be treated identically by the scheduler
 */
public enum TaskType {
    /**
     * Tally Creation - Process ballot IDs to create encrypted tallies
     */
    TALLY_CREATION,
    
    /**
     * Partial Decryption Share - Process chunks for guardian decryption
     */
    PARTIAL_DECRYPTION,
    
    /**
     * Compensated Decryption Share - Process compensated shares for missing guardians
     */
    COMPENSATED_DECRYPTION,
    
    /**
     * Combine Decryption Shares - Combine all decryption shares
     */
    COMBINE_DECRYPTION
}
