package com.amarvote.amarvote.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "decryption_worker_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecryptionWorkerLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "decryption_worker_log_id")
    private Long decryptionWorkerLogId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "election_center_id", nullable = false)
    private Long electionCenterId;

    @Column(name = "guardian_id", nullable = false)
    private Long guardianId;

    @Column(name = "decrypting_guardian_id", nullable = false)
    private Long decryptingGuardianId;

    @Column(name = "decryption_type", length = 50, nullable = false)
    private String decryptionType; // 'PARTIAL' or 'COMPENSATED'

    @Column(name = "chunk_number", nullable = false)
    private Integer chunkNumber;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "status", length = 50)
    @Builder.Default
    private String status = "IN_PROGRESS";

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
