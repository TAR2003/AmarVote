package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecryptionStatusResponse {
    private boolean success;
    private String status; // pending, in_progress, completed, failed
    private String message;
    
    // Progress tracking
    private Integer totalChunks;
    private Integer processedChunks;
    private Double progressPercentage;
    
    // Current phase information
    private String currentPhase; // partial_decryption, compensated_shares_generation
    private Integer currentChunkNumber;
    
    // Compensated guardian details
    private Long compensatingForGuardianId;
    private String compensatingForGuardianName;
    private Integer totalCompensatedGuardians;
    private Integer processedCompensatedGuardians;
    private Double compensatedProgressPercentage;
    
    // Metadata
    private String guardianEmail;
    private String guardianName;
    private String startedAt;
    private String completedAt;
    private String errorMessage;
    
    // ✅ NEW: Timing information for each phase
    private String partialDecryptionStartedAt;
    private String partialDecryptionCompletedAt;
    private Long partialDecryptionDurationSeconds;
    private String compensatedSharesStartedAt;
    private String compensatedSharesCompletedAt;
    private Long compensatedSharesDurationSeconds;
    private Long totalDurationSeconds;
    
    // Lock metadata - shows who initiated the operation
    private String lockHeldBy;  // Email of user who holds the lock
    private String lockStartTime;  // When the lock was acquired
    private Boolean isLocked;  // Whether a lock exists
}
