package com.amarvote.amarvote.model;

import java.time.LocalDateTime;

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
@Table(name = "task_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long logId;
    
    @Column(name = "election_id", nullable = false)
    private Long electionId;
    
    @Column(name = "task_type", nullable = false, length = 100)
    private String taskType; // TALLY_CREATION, GUARDIAN_PARTIAL_DECRYPTION, COMPENSATED_DECRYPTION, COMBINE_DECRYPTION
   
    @Column(name = "task_description", columnDefinition = "TEXT")
    private String taskDescription; // Detailed description of the task
    
    @Column(name = "user_email", length = 255)
    private String userEmail; // Email of the user who triggered the task
    
    @Column(name = "guardian_id")
    private Long guardianId; // For guardian-specific tasks
    
    @Column(name = "compensating_guardian_id")
    private Long compensatingGuardianId; // For compensated decryption tasks
    
    @Column(name = "missing_guardian_id")
    private Long missingGuardianId; // For compensated decryption tasks
    
    @Column(name = "chunk_id")
    private Long chunkId; // For chunk-specific tasks (election_center_id)
    
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;
    
    @Column(name = "end_time")
    private LocalDateTime endTime;
    
    @Column(name = "duration_ms")
    private Long durationMs; // Duration in milliseconds
    
    @Column(name = "status", length = 50)
    private String status; // STARTED, COMPLETED, FAILED
    
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage; // Error message if failed
    
    @Column(name = "additional_data", columnDefinition = "TEXT")
    private String additionalData; // JSON string for any additional data
}
