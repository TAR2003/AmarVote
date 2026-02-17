package com.amarvote.amarvote.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.TaskLog;

@Repository
public interface TaskLogRepository extends JpaRepository<TaskLog, Long> {
    
    // Find all task logs for a specific election, ordered by start time
    List<TaskLog> findByElectionIdOrderByStartTimeAsc(Long electionId);
    
    // Find task logs by election and task type
    List<TaskLog> findByElectionIdAndTaskTypeOrderByStartTimeAsc(Long electionId, String taskType);
    
    // Find task logs by election and status
    List<TaskLog> findByElectionIdAndStatusOrderByStartTimeAsc(Long electionId, String status);
    
    // Find task logs for a specific guardian
    List<TaskLog> findByElectionIdAndGuardianIdOrderByStartTimeAsc(Long electionId, Long guardianId);
    
    // Find task logs for compensated decryption by compensating and missing guardian
    List<TaskLog> findByElectionIdAndCompensatingGuardianIdAndMissingGuardianIdOrderByStartTimeAsc(
        Long electionId, Long compensatingGuardianId, Long missingGuardianId);
    
    // Find task logs by user email
    List<TaskLog> findByElectionIdAndUserEmailOrderByStartTimeAsc(Long electionId, String userEmail);
    
    // Find task logs within a time range
    @Query("SELECT t FROM TaskLog t WHERE t.electionId = :electionId AND t.startTime >= :startTime AND t.startTime <= :endTime ORDER BY t.startTime ASC")
    List<TaskLog> findByElectionIdAndTimeRange(
        @Param("electionId") Long electionId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);
    
    // Find task logs by chunk ID
    List<TaskLog> findByElectionIdAndChunkIdOrderByStartTimeAsc(Long electionId, Long chunkId);
}
