package com.amarvote.amarvote.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity to track job progress for message queue processing
 * Replaces the old TallyCreationStatus and DecryptionStatus tables
 */
@Entity
@Table(name = "election_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElectionJob {
    
    @Id
    @Column(name = "job_id", columnDefinition = "UUID")
    private UUID jobId;
    
    @Column(name = "election_id", nullable = false)
    private Long electionId;
    
    @Column(name = "operation_type", nullable = false, length = 50)
    private String operationType; // TALLY, DECRYPTION, COMBINE, COMPENSATED_DECRYPTION
    
    @Column(name = "status", nullable = false, length = 50)
    private String status; // QUEUED, IN_PROGRESS, COMPLETED, FAILED
    
    @Column(name = "total_chunks", nullable = false)
    private int totalChunks;
    
    @Column(name = "processed_chunks", nullable = false)
    private int processedChunks = 0;
    
    @Column(name = "failed_chunks", nullable = false)
    private int failedChunks = 0;
    
    @Column(name = "created_by", length = 255)
    private String createdBy;
    
    @Column(name = "started_at", nullable = false)
    private Instant startedAt;
    
    @Column(name = "completed_at")
    private Instant completedAt;
    
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    
    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;
    
    /**
     * Calculate progress percentage
     */
    @Transient
    public double getProgressPercent() {
        if (totalChunks == 0) return 0.0;
        return (processedChunks * 100.0) / totalChunks;
    }
    
    /**
     * Check if job is complete
     */
    @Transient
    public boolean isComplete() {
        return "COMPLETED".equals(status) || "FAILED".equals(status);
    }
    
    /**
     * Increment processed chunks count
     */
    public void incrementProcessed() {
        this.processedChunks++;
        if (this.processedChunks >= this.totalChunks) {
            this.status = "COMPLETED";
            this.completedAt = Instant.now();
        }
    }
    
    /**
     * Increment failed chunks count
     */
    public void incrementFailed() {
        this.failedChunks++;
    }
}
