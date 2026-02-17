package com.amarvote.amarvote.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.amarvote.amarvote.model.TaskLog;
import com.amarvote.amarvote.repository.TaskLogRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TaskLogService {
    
    private final TaskLogRepository taskLogRepository;
    
    /**
     * Log the start of a task
     */
    public TaskLog logTaskStart(Long electionId, String taskType, String taskDescription, String userEmail) {
        TaskLog taskLog = TaskLog.builder()
            .electionId(electionId)
            .taskType(taskType)
            .taskDescription(taskDescription)
            .userEmail(userEmail)
            .startTime(LocalDateTime.now())
            .status("STARTED")
            .build();
        
        return taskLogRepository.save(taskLog);
    }
    
    /**
     * Log the start of a guardian-specific task
     */
    public TaskLog logGuardianTaskStart(Long electionId, String taskType, String taskDescription, 
                                         String userEmail, Long guardianId) {
        TaskLog taskLog = TaskLog.builder()
            .electionId(electionId)
            .taskType(taskType)
            .taskDescription(taskDescription)
            .userEmail(userEmail)
            .guardianId(guardianId)
            .startTime(LocalDateTime.now())
            .status("STARTED")
            .build();
        
        return taskLogRepository.save(taskLog);
    }
    
    /**
     * Log the start of a compensated decryption task
     */
    public TaskLog logCompensatedTaskStart(Long electionId, String taskType, String taskDescription,
                                            String userEmail, Long compensatingGuardianId, 
                                            Long missingGuardianId, Long chunkId) {
        TaskLog taskLog = TaskLog.builder()
            .electionId(electionId)
            .taskType(taskType)
            .taskDescription(taskDescription)
            .userEmail(userEmail)
            .compensatingGuardianId(compensatingGuardianId)
            .missingGuardianId(missingGuardianId)
            .chunkId(chunkId)
            .startTime(LocalDateTime.now())
            .status("STARTED")
            .build();
        
        return taskLogRepository.save(taskLog);
    }
    
    /**
     * Log the start of a chunk-specific task
     */
    public TaskLog logChunkTaskStart(Long electionId, String taskType, String taskDescription,
                                      String userEmail, Long chunkId) {
        TaskLog taskLog = TaskLog.builder()
            .electionId(electionId)
            .taskType(taskType)
            .taskDescription(taskDescription)
            .userEmail(userEmail)
            .chunkId(chunkId)
            .startTime(LocalDateTime.now())
            .status("STARTED")
            .build();
        
        return taskLogRepository.save(taskLog);
    }
    
    /**
     * Log the completion of a task
     */
    public TaskLog logTaskComplete(TaskLog taskLog) {
        LocalDateTime endTime = LocalDateTime.now();
        taskLog.setEndTime(endTime);
        taskLog.setStatus("COMPLETED");
        
        // Calculate duration in milliseconds
        long durationMs = java.time.Duration.between(taskLog.getStartTime(), endTime).toMillis();
        taskLog.setDurationMs(durationMs);
        
        return taskLogRepository.save(taskLog);
    }
    
    /**
     * Log a task failure
     */
    public TaskLog logTaskFailure(TaskLog taskLog, String errorMessage) {
        LocalDateTime endTime = LocalDateTime.now();
        taskLog.setEndTime(endTime);
        taskLog.setStatus("FAILED");
        taskLog.setErrorMessage(errorMessage);
        
        // Calculate duration in milliseconds
        long durationMs = java.time.Duration.between(taskLog.getStartTime(), endTime).toMillis();
        taskLog.setDurationMs(durationMs);
        
        return taskLogRepository.save(taskLog);
    }
    
    /**
     * Get all task logs for an election
     */
    public List<TaskLog> getTaskLogsByElection(Long electionId) {
        return taskLogRepository.findByElectionIdOrderByStartTimeAsc(electionId);
    }
    
    /**
     * Get task logs by election and task type
     */
    public List<TaskLog> getTaskLogsByElectionAndType(Long electionId, String taskType) {
        return taskLogRepository.findByElectionIdAndTaskTypeOrderByStartTimeAsc(electionId, taskType);
    }
    
    /**
     * Get task logs for a specific guardian
     */
    public List<TaskLog> getTaskLogsByGuardian(Long electionId, Long guardianId) {
        return taskLogRepository.findByElectionIdAndGuardianIdOrderByStartTimeAsc(electionId, guardianId);
    }
}
