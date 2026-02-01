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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * @deprecated This entity is no longer used. Progress tracking is now handled by:
 * - RoundRobinTaskScheduler for real-time chunk state tracking
 * - Database queries on ElectionCenter table for persistent state
 * This table can be safely removed from the database in future cleanup.
 * See: TallyService.getTallyStatus() for current implementation
 */
@Deprecated
@Entity
@Table(name = "tally_creation_status")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TallyCreationStatus {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tally_status_id")
    private Long tallyStatusId;

    @Column(name = "election_id", nullable = false, unique = true)
    private Long electionId;

    @Column(name = "status", nullable = false)
    private String status; // pending, in_progress, completed, failed

    @Column(name = "total_chunks", nullable = false)
    private Integer totalChunks;

    @Column(name = "processed_chunks", nullable = false)
    private Integer processedChunks;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
