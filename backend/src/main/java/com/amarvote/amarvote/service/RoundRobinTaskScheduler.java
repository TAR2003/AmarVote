package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.worker.CombineDecryptionTask;
import com.amarvote.amarvote.dto.worker.CompensatedDecryptionTask;
import com.amarvote.amarvote.dto.worker.PartialDecryptionTask;
import com.amarvote.amarvote.dto.worker.TallyCreationTask;
import com.amarvote.amarvote.model.scheduler.Chunk;
import com.amarvote.amarvote.model.scheduler.ChunkState;
import com.amarvote.amarvote.model.scheduler.TaskInstance;
import com.amarvote.amarvote.model.scheduler.TaskType;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 📜 ROUND-ROBIN TASK SCHEDULER
 * 
 * This service implements fair round-robin chunk processing across all four task types:
 * 1. Tally Creation
 * 2. Partial Decryption Share
 * 3. Compensated Decryption Share
 * 4. Combine Decryption Shares
 * 
 * CORE PRINCIPLES (NON-NEGOTIABLE):
 * - No task type or task instance can starve others
 * - Progress is made across ALL active tasks
 * - Workers process one chunk at a time (prefetch=1)
 * - Round-robin interleaving prevents bulk processing
 * 
 * FAIRNESS GUARANTEES:
 * - Every active task instance eventually makes progress
 * - No task instance can advance arbitrarily far ahead
 * - Bounded unfairness across all tasks
 * - Maximal utilization when work and workers exist
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoundRobinTaskScheduler {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    /**
     * All active task instances (key: taskInstanceId)
     */
    private final ConcurrentHashMap<String, TaskInstance> taskInstances = new ConcurrentHashMap<>();
    
    /**
     * Round-robin index across task instances
     */
    private final AtomicInteger taskRoundRobinIndex = new AtomicInteger(0);
    
    /**
     * Chunks by ID for quick lookup
     */
    private final ConcurrentHashMap<String, Chunk> chunksById = new ConcurrentHashMap<>();
    
    /**
     * Lock to prevent concurrent scheduling
     */
    private final Object schedulingLock = new Object();
    
    /**
     * Statistics
     */
    private final AtomicInteger totalChunksQueued = new AtomicInteger(0);
    private final AtomicInteger totalChunksCompleted = new AtomicInteger(0);
    private final AtomicInteger totalChunksFailed = new AtomicInteger(0);
    
    /**
     * Maximum retry attempts for failed chunks
     */
    private static final int MAX_RETRY_ATTEMPTS = 3;
    
    /**
     * Retry delay in milliseconds (exponential backoff)
     */
    private static final long INITIAL_RETRY_DELAY_MS = 5000; // 5 seconds

    // ==================== PUBLIC API ====================

    /**
     * Register a new task instance with all its chunks
     * This is the entry point for all task types
     * 
     * @param taskType The type of task
     * @param electionId The election ID
     * @param guardianId Guardian ID (optional, for partial/compensated decryption)
     * @param sourceGuardianId Source guardian ID (optional, for compensated decryption)
     * @param targetGuardianId Target guardian ID (optional, for compensated decryption)
     * @param taskDataList List of serialized task data (one per chunk)
     * @return The task instance ID
     */
    public String registerTask(
            TaskType taskType,
            Long electionId,
            Long guardianId,
            Long sourceGuardianId,
            Long targetGuardianId,
            List<String> taskDataList) {
        
        // Generate unique task instance ID
        String taskInstanceId = generateTaskInstanceId(taskType, electionId, guardianId, sourceGuardianId, targetGuardianId);
        
        log.info("📋 REGISTERING TASK INSTANCE: {} (type={}, chunks={})", taskInstanceId, taskType, taskDataList.size());
        
        // Create chunks
        List<Chunk> chunks = new ArrayList<>();
        for (int i = 0; i < taskDataList.size(); i++) {
            String chunkId = taskInstanceId + "_chunk_" + (i + 1);
            Chunk chunk = Chunk.builder()
                .chunkId(chunkId)
                .taskInstanceId(taskInstanceId)
                .chunkNumber(i + 1)
                .state(ChunkState.PENDING)
                .taskData(taskDataList.get(i))
                .createdAt(Instant.now())
                .attemptCount(0)
                .build();
            
            chunks.add(chunk);
            chunksById.put(chunkId, chunk);
        }
        
        // Create task instance
        TaskInstance taskInstance = TaskInstance.builder()
            .taskInstanceId(taskInstanceId)
            .taskType(taskType)
            .electionId(electionId)
            .guardianId(guardianId)
            .sourceGuardianId(sourceGuardianId)
            .targetGuardianId(targetGuardianId)
            .chunks(chunks)
            .createdAt(Instant.now())
            .nextChunkIndex(new AtomicInteger(0))
            .build();
        
        taskInstances.put(taskInstanceId, taskInstance);
        
        log.info("✅ Task instance registered: {} with {} chunks", taskInstanceId, chunks.size());
        log.info("📊 Active task instances: {}", taskInstances.size());
        
        return taskInstanceId;
    }

    /**
     * Update chunk state (called by workers)
     * 
     * @param chunkId The chunk ID
     * @param newState The new state
     * @param errorMessage Error message (if failed)
     */
    public void updateChunkState(String chunkId, ChunkState newState, String errorMessage) {
        Chunk chunk = chunksById.get(chunkId);
        if (chunk == null) {
            log.warn("⚠️ Chunk not found: {}", chunkId);
            return;
        }
        
        ChunkState oldState = chunk.getState();
        chunk.setState(newState);
        
        // Update timestamps
        switch (newState) {
            case PENDING:
                // No timestamp update needed for pending state
                break;
            case QUEUED:
                chunk.setQueuedAt(Instant.now());
                break;
            case PROCESSING:
                chunk.setProcessingStartedAt(Instant.now());
                chunk.setAttemptCount(chunk.getAttemptCount() + 1);
                break;
            case COMPLETED:
                chunk.setCompletedAt(Instant.now());
                totalChunksCompleted.incrementAndGet();
                break;
            case FAILED:
                chunk.setCompletedAt(Instant.now());
                chunk.setErrorMessage(errorMessage);
                
                // Implement retry logic
                if (chunk.getAttemptCount() < MAX_RETRY_ATTEMPTS) {
                    // Calculate exponential backoff delay
                    long retryDelay = INITIAL_RETRY_DELAY_MS * (1L << (chunk.getAttemptCount() - 1));
                    
                    log.warn("⚠️ Chunk FAILED: {} | Attempt: {}/{} | Will retry in {}ms", 
                        chunkId, chunk.getAttemptCount(), MAX_RETRY_ATTEMPTS, retryDelay);
                    
                    // Reset state to PENDING after delay to allow retry
                    // The scheduling loop will pick it up automatically
                    scheduleRetry(chunk, retryDelay);
                } else {
                    // Max retries exceeded - mark as permanently failed
                    log.error("❌ Chunk PERMANENTLY FAILED: {} | Max retries exceeded ({}) | Error: {}", 
                        chunkId, MAX_RETRY_ATTEMPTS, errorMessage);
                    totalChunksFailed.incrementAndGet();
                }
                break;
        }
        
        log.debug("🔄 Chunk state transition: {} | {} -> {} | attempt={}", 
            chunkId, oldState, newState, chunk.getAttemptCount());
        
        // Check if task instance is complete (but DON'T remove it)
        TaskInstance taskInstance = taskInstances.get(chunk.getTaskInstanceId());
        if (taskInstance != null && !taskInstance.isActive()) {
            log.info("✅ Task instance COMPLETED: {}", taskInstance.getTaskInstanceId());
            logTaskInstanceProgress(taskInstance);
            
            // ✅ KEEP task instance in scheduler for status queries
            // The scheduler won't publish new chunks (isActive() = false)
            // But status API can still read progress for display
            log.info("✅ Task instance kept in memory for status tracking");
        }
    }

    /**
     * Schedule a retry for a failed chunk after a delay
     */
    private void scheduleRetry(Chunk chunk, long delayMs) {
        // Use a separate thread to avoid blocking the scheduling loop
        new Thread(() -> {
            try {
                Thread.sleep(delayMs);
                
                // Reset chunk state to PENDING so it can be retried
                synchronized (schedulingLock) {
                    if (chunk.getState() == ChunkState.FAILED && chunk.getAttemptCount() < MAX_RETRY_ATTEMPTS) {
                        chunk.setState(ChunkState.PENDING);
                        chunk.setErrorMessage(null); // Clear error message
                        log.info("🔄 RETRY SCHEDULED: {} | Attempt: {}/{}", 
                            chunk.getChunkId(), chunk.getAttemptCount() + 1, MAX_RETRY_ATTEMPTS);
                    }
                }
            } catch (InterruptedException e) {
                log.error("❌ Retry scheduling interrupted for chunk: {}", chunk.getChunkId());
                Thread.currentThread().interrupt();
            }
        }, "ChunkRetryScheduler-" + chunk.getChunkId()).start();
    }

    /**
     * Get progress for a specific task instance
     */
    public TaskInstance.TaskProgress getTaskProgress(String taskInstanceId) {
        TaskInstance taskInstance = taskInstances.get(taskInstanceId);
        if (taskInstance == null) {
            return null;
        }
        return taskInstance.getProgress();
    }

    /**
     * Get progress for all task instances of a specific election
     */
    public List<TaskInstance.TaskProgress> getElectionProgress(Long electionId) {
        return taskInstances.values().stream()
            .filter(ti -> ti.getElectionId().equals(electionId))
            .map(TaskInstance::getProgress)
            .collect(Collectors.toList());
    }

    /**
     * Get overall system statistics
     */
    public Map<String, Object> getSystemStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeTaskInstances", taskInstances.size());
        stats.put("totalChunksQueued", totalChunksQueued.get());
        stats.put("totalChunksCompleted", totalChunksCompleted.get());
        stats.put("totalChunksFailed", totalChunksFailed.get());
        
        // Count by task type
        Map<TaskType, Long> byType = taskInstances.values().stream()
            .collect(Collectors.groupingBy(TaskInstance::getTaskType, Collectors.counting()));
        stats.put("taskInstancesByType", byType);
        
        // Count by state
        Map<ChunkState, Long> byState = chunksById.values().stream()
            .collect(Collectors.groupingBy(Chunk::getState, Collectors.counting()));
        stats.put("chunksByState", byState);
        
        return stats;
    }

    // ==================== SCHEDULING LOOP ====================

    /**
     * Main scheduling loop - runs every 100ms
     * Publishes chunks in round-robin order across all active task instances
     * 
     * ALGORITHM:
     * 1. Get list of all active task instances
     * 2. Iterate over them in round-robin order
     * 3. For each task instance:
     *    - Publish at most ONE pending chunk
     *    - Skip if no pending chunks exist
     * 4. Repeat continuously while work exists
     * 
     * FAIRNESS WITH CONCURRENT PROCESSING:
     * ====================================
     * This scheduler ensures fair chunk distribution, and when combined with
     * multiple workers (configured in application.properties), enables true
     * concurrent processing across tasks.
     * 
     * Example with 6 workers:
     * - Cycle 1: Publish A-chunk-1, B-chunk-1, A-chunk-2, B-chunk-2, A-chunk-3, B-chunk-3
     * - Workers immediately pick up: Worker1→A-1, Worker2→B-1, Worker3→A-2, Worker4→B-2, etc.
     * - Both tasks progress simultaneously in round-robin fashion!
     * 
     * This prevents the old behavior where Task B would wait until Task A completed
     * an entire phase before starting.
     */
    @Scheduled(fixedDelay = 100, initialDelay = 1000)
    public void scheduleChunks() {
        synchronized (schedulingLock) {
            // Get all active task instances
            List<TaskInstance> activeInstances = taskInstances.values().stream()
                .filter(TaskInstance::isActive)
                .collect(Collectors.toList());
            
            if (activeInstances.isEmpty()) {
                return; // No work to do
            }
            
            // Log active tasks for debugging (especially useful when multiple tasks are active)
            if (activeInstances.size() > 1) {
                log.info("🔄 ROUND-ROBIN: {} active tasks being processed concurrently", activeInstances.size());
                for (TaskInstance ti : activeInstances) {
                    TaskInstance.TaskProgress progress = ti.getProgress();
                    log.info("  - Task: {} | Type: {} | Guardian: {} | Progress: {}/{} ({:.1f}%) | Processing: {} | Queued: {}", 
                        ti.getTaskInstanceId(), ti.getTaskType(), ti.getGuardianId(),
                        progress.getCompletedChunks(), progress.getTotalChunks(),
                        progress.getCompletionPercentage(),
                        progress.getProcessingChunks(), progress.getQueuedChunks());
                }
            }
            
            // Round-robin across active task instances
            int startIndex = taskRoundRobinIndex.get() % activeInstances.size();
            int chunksPublished = 0;
            
            for (int i = 0; i < activeInstances.size(); i++) {
                int index = (startIndex + i) % activeInstances.size();
                TaskInstance taskInstance = activeInstances.get(index);
                
                // Get next pending chunk for this task instance
                Chunk chunk = taskInstance.getNextPendingChunk();
                if (chunk != null) {
                    publishChunk(chunk, taskInstance.getTaskType());
                    chunksPublished++;
                    
                    if (activeInstances.size() > 1) {
                        log.info("📤 Published chunk from Task {} (Guardian {}) - Workers can process concurrently", 
                            taskInstance.getTaskInstanceId(), taskInstance.getGuardianId());
                    }
                }
            }
            
            // Update round-robin index for next cycle
            taskRoundRobinIndex.incrementAndGet();
            
            if (chunksPublished > 0) {
                log.debug("📤 Published {} chunks in this cycle | Active tasks: {} | These chunks can be processed by {} workers simultaneously", 
                    chunksPublished, activeInstances.size(), chunksPublished);
            }
        }
    }

    /**
     * Publish a single chunk to the appropriate queue
     */
    private void publishChunk(Chunk chunk, TaskType taskType) {
        try {
            // Update state to QUEUED
            updateChunkState(chunk.getChunkId(), ChunkState.QUEUED, null);
            
            // Deserialize task data and inject chunkId
            Object task = deserializeAndInjectChunkId(chunk.getTaskData(), chunk.getChunkId(), taskType);
            String queueRoutingKey = getRoutingKeyForTaskType(taskType);
            
            rabbitTemplate.convertAndSend(
                RabbitMQConfig.TASK_EXCHANGE,
                queueRoutingKey,
                task
            );
            
            totalChunksQueued.incrementAndGet();
            
            log.debug("📤 QUEUED: {} | Type: {} | Chunk: {}/{}", 
                chunk.getChunkId(), taskType, chunk.getChunkNumber(), 
                taskInstances.get(chunk.getTaskInstanceId()).getChunks().size());
            
        } catch (Exception e) {
            log.error("❌ Failed to publish chunk: {} | Error: {}", chunk.getChunkId(), e.getMessage());
            updateChunkState(chunk.getChunkId(), ChunkState.FAILED, e.getMessage());
        }
    }

    /**
     * Deserialize task data and inject chunkId
     */
    private Object deserializeAndInjectChunkId(String taskData, String chunkId, TaskType taskType) throws Exception {
        switch (taskType) {
            case TALLY_CREATION:
                TallyCreationTask tallyTask = objectMapper.readValue(taskData, TallyCreationTask.class);
                tallyTask.setChunkId(chunkId);
                return tallyTask;
            case PARTIAL_DECRYPTION:
                PartialDecryptionTask partialTask = objectMapper.readValue(taskData, PartialDecryptionTask.class);
                partialTask.setChunkId(chunkId);
                return partialTask;
            case COMPENSATED_DECRYPTION:
                CompensatedDecryptionTask compensatedTask = objectMapper.readValue(taskData, CompensatedDecryptionTask.class);
                compensatedTask.setChunkId(chunkId);
                return compensatedTask;
            case COMBINE_DECRYPTION:
                CombineDecryptionTask combineTask = objectMapper.readValue(taskData, CombineDecryptionTask.class);
                combineTask.setChunkId(chunkId);
                return combineTask;
            default:
                throw new IllegalArgumentException("Unknown task type: " + taskType);
        }
    }

    /**
     * Get routing key for task type
     */
    private String getRoutingKeyForTaskType(TaskType taskType) {
        switch (taskType) {
            case TALLY_CREATION:
                return RabbitMQConfig.TALLY_CREATION_ROUTING_KEY;
            case PARTIAL_DECRYPTION:
                return RabbitMQConfig.PARTIAL_DECRYPTION_ROUTING_KEY;
            case COMPENSATED_DECRYPTION:
                return RabbitMQConfig.COMPENSATED_DECRYPTION_ROUTING_KEY;
            case COMBINE_DECRYPTION:
                return RabbitMQConfig.COMBINE_DECRYPTION_ROUTING_KEY;
            default:
                throw new IllegalArgumentException("Unknown task type: " + taskType);
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Generate unique task instance ID
     */
    private String generateTaskInstanceId(
            TaskType taskType,
            Long electionId,
            Long guardianId,
            Long sourceGuardianId,
            Long targetGuardianId) {
        
        StringBuilder id = new StringBuilder();
        id.append(taskType.name().toLowerCase());
        id.append("_e").append(electionId);
        
        if (guardianId != null) {
            id.append("_g").append(guardianId);
        }
        if (sourceGuardianId != null) {
            id.append("_sg").append(sourceGuardianId);
        }
        if (targetGuardianId != null) {
            id.append("_tg").append(targetGuardianId);
        }
        
        id.append("_").append(System.currentTimeMillis());
        
        return id.toString();
    }

    /**
     * Log task instance progress
     */
    private void logTaskInstanceProgress(TaskInstance taskInstance) {
        TaskInstance.TaskProgress progress = taskInstance.getProgress();
        log.info("📊 TASK PROGRESS: {} | Type: {} | Completed: {}/{} ({:.1f}%) | Failed: {} | Processing: {} | Queued: {} | Pending: {}",
            progress.getTaskInstanceId(),
            progress.getTaskType(),
            progress.getCompletedChunks(),
            progress.getTotalChunks(),
            progress.getCompletionPercentage(),
            progress.getFailedChunks(),
            progress.getProcessingChunks(),
            progress.getQueuedChunks(),
            progress.getPendingChunks()
        );
    }

    /**
     * Periodic logging of system state (every 10 seconds)
     */
    @Scheduled(fixedDelay = 10000, initialDelay = 5000)
    public void logSystemState() {
        if (taskInstances.isEmpty()) {
            return;
        }
        
        log.info("=== SCHEDULER STATE ===");
        log.info("Active Task Instances: {}", taskInstances.size());
        log.info("Total Chunks: Queued={}, Completed={}, Failed={}", 
            totalChunksQueued.get(), totalChunksCompleted.get(), totalChunksFailed.get());
        
        // Log progress for each active task instance
        taskInstances.values().forEach(this::logTaskInstanceProgress);
        
        log.info("======================");
    }
}
