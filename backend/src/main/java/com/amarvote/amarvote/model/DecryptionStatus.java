package com.amarvote.amarvote.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "decryption_status")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecryptionStatus {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "decryption_status_id")
    private Long decryptionStatusId;
    
    @Column(name = "election_id", nullable = false)
    private Long electionId;
    
    @Column(name = "guardian_id", nullable = false)
    private Long guardianId;
    
    @Column(name = "status", nullable = false, length = 50)
    private String status; // pending, in_progress, completed, failed
    
    // Progress tracking
    @Column(name = "total_chunks", nullable = false)
    private Integer totalChunks;
    
    @Column(name = "processed_chunks", nullable = false)
    private Integer processedChunks;
    
    // Current processing phase
    @Column(name = "current_phase", length = 100)
    private String currentPhase; // partial_decryption, compensated_shares_generation
    
    @Column(name = "current_chunk_number")
    private Integer currentChunkNumber;
    
    // Compensated guardian tracking
    @Column(name = "compensating_for_guardian_id")
    private Long compensatingForGuardianId;
    
    @Column(name = "compensating_for_guardian_name", length = 255)
    private String compensatingForGuardianName;
    
    @Column(name = "total_compensated_guardians")
    private Integer totalCompensatedGuardians;
    
    @Column(name = "processed_compensated_guardians")
    private Integer processedCompensatedGuardians;
    
    // Metadata
    @Column(name = "guardian_email", length = 255)
    private String guardianEmail;
    
    @Column(name = "guardian_name", length = 255)
    private String guardianName;
    
    @Column(name = "started_at")
    private Instant startedAt;
    
    @Column(name = "completed_at")
    private Instant completedAt;
    
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    
    @Column(name = "created_at")
    private Instant createdAt;
    
    @Column(name = "updated_at")
    private Instant updatedAt;
}
