package com.amarvote.amarvote.model.scheduler;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Represents one execution of one of the four task types
 * (e.g., one election tally, one batch of partial decryptions)
 * 
 * A task instance is ACTIVE if it has at least one chunk not yet completed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskInstance {
    /**
     * Unique identifier for this task instance
     * Format: taskType_electionId_guardianId_timestamp
     */
    private String taskInstanceId;
    
    /**
     * Type of task
     */
    private TaskType taskType;
    
    /**
     * Election ID this task belongs to
     */
    private Long electionId;
    
    /**
     * Guardian ID (if applicable, null for tally creation and combine decryption)
     */
    private Long guardianId;
    
    /**
     * Source Guardian ID (for compensated decryption)
     */
    private Long sourceGuardianId;
    
    /**
     * Target Guardian ID (for compensated decryption)
     */
    private Long targetGuardianId;
    
    /**
     * All chunks belonging to this task instance
     */
    @Builder.Default
    private List<Chunk> chunks = new ArrayList<>();
    
    /**
     * Timestamp when task instance was created
     */
    @Builder.Default
    private Instant createdAt = Instant.now();
    
    /**
     * Index for round-robin scheduling (which chunk to publish next)
     */
    @Builder.Default
    private AtomicInteger nextChunkIndex = new AtomicInteger(0);
    
    /**
     * Check if task instance is active (has at least one chunk not yet completed)
     */
    public boolean isActive() {
        return chunks.stream().anyMatch(Chunk::isActive);
    }
    
    /**
     * Get next pending chunk to queue (round-robin within task instance)
     */
    public Chunk getNextPendingChunk() {
        // Get all pending chunks that can be queued
        List<Chunk> pendingChunks = chunks.stream()
            .filter(Chunk::canBeQueued)
            .collect(Collectors.toList());
        
        if (pendingChunks.isEmpty()) {
            return null;
        }
        
        // Round-robin: get next chunk index and wrap around
        int index = nextChunkIndex.getAndIncrement() % pendingChunks.size();
        return pendingChunks.get(index);
    }
    
    /**
     * Get progress statistics
     */
    public TaskProgress getProgress() {
        long total = chunks.size();
        long completed = chunks.stream().filter(c -> c.getState() == ChunkState.COMPLETED).count();
        long failed = chunks.stream().filter(c -> c.getState() == ChunkState.FAILED).count();
        long processing = chunks.stream().filter(c -> c.getState() == ChunkState.PROCESSING).count();
        long queued = chunks.stream().filter(c -> c.getState() == ChunkState.QUEUED).count();
        long pending = chunks.stream().filter(c -> c.getState() == ChunkState.PENDING).count();
        
        return TaskProgress.builder()
            .taskInstanceId(taskInstanceId)
            .taskType(taskType)
            .guardianId(guardianId)
            .sourceGuardianId(sourceGuardianId)
            .targetGuardianId(targetGuardianId)
            .totalChunks(total)
            .completedChunks(completed)
            .failedChunks(failed)
            .processingChunks(processing)
            .queuedChunks(queued)
            .pendingChunks(pending)
            .build();
    }
    
    /**
     * Simple progress data class
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskProgress {
        private String taskInstanceId;
        private TaskType taskType;
        private Long guardianId;
        private Long sourceGuardianId;
        private Long targetGuardianId;
        private long totalChunks;
        private long completedChunks;
        private long failedChunks;
        private long processingChunks;
        private long queuedChunks;
        private long pendingChunks;
        
        public double getCompletionPercentage() {
            return totalChunks == 0 ? 0.0 : (completedChunks * 100.0) / totalChunks;
        }
        
        public boolean isComplete() {
            return completedChunks + failedChunks == totalChunks;
        }
    }
}
