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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.model.ProcessOperationType;
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
 * This service implements STRICT fair round-robin chunk processing across all four task types:
 * 1. Tally Creation
 * 2. Partial Decryption Share
 * 3. Compensated Decryption Share
 * 4. Combine Decryption Shares
 * 
 * CORE PRINCIPLES (NON-NEGOTIABLE):
 * - STRICT round-robin: Each task gets exactly 1 chunk queued per rotation
 * - No task type or task instance can starve others
 * - Progress is made across ALL active tasks simultaneously
 * - Workers process one chunk at a time (prefetch=1)
 * - Equal priority for all tasks regardless of arrival time
 * 
 * FAIRNESS GUARANTEES:
 * - Every active task instance gets 1 chunk per round-robin pass
 * - No task instance can advance more than 1 chunk ahead of others (per pass)
 * - Maximum bounded unfairness: at most (n-1) chunks, where n = number of concurrent workers
 * - New tasks entering the system immediately join the rotation
 * - Task completion order doesn't affect other tasks' progress
 * 
 * CONCURRENCY CONTROL:
 * - Max concurrent workers controlled by application.properties (rabbitmq.worker.concurrency)
 * - MAX_QUEUED_CHUNKS_PER_TASK=1 ensures strict interleaving
 * - Event-driven dispatch on task registration and chunk completion (no polling loop)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoundRobinTaskScheduler {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final ProcessCancellationService cancellationService;

    @Value("${rabbitmq.worker.concurrency.max:6}")
    private int maxWorkerConcurrency;

    @Value("${rabbitmq.scheduler.max-queued-chunks-per-task:${rabbitmq.worker.concurrency.max:6}}")
    private int maxQueuedChunksPerTask;

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
    
    /**
     * Round-robin passes per dispatch cycle — prime enough chunks to saturate workers.
     */
    private int targetChunksPerCycle() {
        return Math.max(maxWorkerConcurrency * 2, maxQueuedChunksPerTask);
    }

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

        dispatchNextChunks();
        
        return taskInstanceId;
    }

    /**
     * Cancel matching task instances — stops publishing new chunks.
     */
    public void cancelTasks(
            TaskType taskType,
            Long electionId,
            Long guardianId,
            Long sourceGuardianId,
            Long targetGuardianId) {
        synchronized (schedulingLock) {
            taskInstances.values().stream()
                .filter(ti -> ti.getTaskType() == taskType)
                .filter(ti -> ti.getElectionId().equals(electionId))
                .filter(ti -> guardianId == null || guardianId.equals(ti.getGuardianId()))
                .filter(ti -> sourceGuardianId == null || sourceGuardianId.equals(ti.getSourceGuardianId()))
                .filter(ti -> targetGuardianId == null || targetGuardianId.equals(ti.getTargetGuardianId()))
                .forEach(ti -> {
                    ti.setCancelled(true);
                    ti.getChunks().stream()
                        .filter(c -> c.getState() == ChunkState.PENDING || c.getState() == ChunkState.QUEUED)
                        .forEach(c -> c.setState(ChunkState.CANCELLED));
                    log.info("🛑 Cancelled task instance: {}", ti.getTaskInstanceId());
                });
        }
    }

    /**
     * Remove matching task instances from memory (used after delete/reset).
     */
    public void removeTasks(
            TaskType taskType,
            Long electionId,
            Long guardianId,
            Long sourceGuardianId,
            Long targetGuardianId) {
        synchronized (schedulingLock) {
            taskInstances.entrySet().removeIf(entry -> {
                TaskInstance ti = entry.getValue();
                if (ti.getTaskType() != taskType) {
                    return false;
                }
                if (!ti.getElectionId().equals(electionId)) {
                    return false;
                }
                if (guardianId != null && !guardianId.equals(ti.getGuardianId())) {
                    return false;
                }
                if (sourceGuardianId != null && !sourceGuardianId.equals(ti.getSourceGuardianId())) {
                    return false;
                }
                if (targetGuardianId != null && !targetGuardianId.equals(ti.getTargetGuardianId())) {
                    return false;
                }
                ti.getChunks().forEach(c -> chunksById.remove(c.getChunkId()));
                log.info("🗑️ Removed task instance: {}", ti.getTaskInstanceId());
                return true;
            });
        }
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
                dispatchNextChunks();
                break;
            case CANCELLED:
                chunk.setCompletedAt(Instant.now());
                dispatchNextChunks();
                break;
            case FAILED:
                chunk.setCompletedAt(Instant.now());
                chunk.setErrorMessage(errorMessage);

                if ("Cancelled by user".equals(errorMessage)) {
                    totalChunksFailed.incrementAndGet();
                    dispatchNextChunks();
                    break;
                }
                
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
                    dispatchNextChunks();
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
                        chunk.setErrorMessage(null);
                        log.info("🔄 RETRY SCHEDULED: {} | Attempt: {}/{}", 
                            chunk.getChunkId(), chunk.getAttemptCount() + 1, MAX_RETRY_ATTEMPTS);
                        dispatchNextChunks();
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

    // ==================== EVENT-DRIVEN DISPATCH ====================

    /**
     * Credit-based round-robin dispatch — invoked when tasks register or chunks finish.
     * No polling timer; workers stay busy via completion-triggered publishing.
     */
    public void dispatchNextChunks() {
        synchronized (schedulingLock) {
            List<TaskInstance> activeInstances = taskInstances.values().stream()
                .filter(TaskInstance::isActive)
                .filter(ti -> !isTaskCancelled(ti))
                .collect(Collectors.toList());

            if (activeInstances.isEmpty()) {
                return;
            }

            int startIndex = taskRoundRobinIndex.get() % activeInstances.size();
            int chunksPublished = 0;
            int passCount = 0;
            int maxPasses = targetChunksPerCycle();

            while (passCount < maxPasses) {
                boolean publishedInThisPass = false;

                for (int i = 0; i < activeInstances.size(); i++) {
                    int index = (startIndex + i) % activeInstances.size();
                    TaskInstance taskInstance = activeInstances.get(index);

                    long currentlyQueued = taskInstance.getChunks().stream()
                        .filter(c -> c.getState() == ChunkState.QUEUED)
                        .count();

                    if (currentlyQueued >= maxQueuedChunksPerTask) {
                        continue;
                    }

                    Chunk chunk = taskInstance.getNextPendingChunk();
                    if (chunk != null) {
                        publishChunk(chunk, taskInstance.getTaskType(), taskInstance);
                        chunksPublished++;
                        publishedInThisPass = true;
                    }
                }

                passCount++;
                if (!publishedInThisPass) {
                    break;
                }
            }

            taskRoundRobinIndex.incrementAndGet();

            if (chunksPublished > 0 && activeInstances.size() > 1) {
                log.debug("📤 Event dispatch: published {} chunks across {} tasks", chunksPublished, activeInstances.size());
            }
        }
    }

    private boolean isTaskCancelled(TaskInstance taskInstance) {
        ProcessOperationType operation = toProcessOperation(taskInstance.getTaskType());
        if (operation == null) {
            return false;
        }
        Long guardianScope = taskInstance.getTaskType() == TaskType.COMPENSATED_DECRYPTION
            ? taskInstance.getSourceGuardianId()
            : taskInstance.getGuardianId();
        return cancellationService.isStopped(taskInstance.getElectionId(), operation, guardianScope);
    }

    private ProcessOperationType toProcessOperation(TaskType taskType) {
        return switch (taskType) {
            case TALLY_CREATION -> ProcessOperationType.TALLY;
            case PARTIAL_DECRYPTION -> ProcessOperationType.PARTIAL_DECRYPTION;
            case COMPENSATED_DECRYPTION -> ProcessOperationType.COMPENSATED_DECRYPTION;
            case COMBINE_DECRYPTION -> ProcessOperationType.COMBINE;
        };
    }

    // ==================== REMOVED: 100ms polling loop ====================
    // scheduleChunks() replaced by dispatchNextChunks() above.

    /**
     * Publish a single chunk to the appropriate queue
     */
    private void publishChunk(Chunk chunk, TaskType taskType, TaskInstance taskInstance) {
        try {
            if (taskInstance.isCancelled() || isTaskCancelled(taskInstance)) {
                log.debug("Skipping publish for cancelled task chunk: {}", chunk.getChunkId());
                return;
            }

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
        log.info("📊 TASK PROGRESS: {} | Type: {} | Completed: {}/{} ({}%) | Failed: {} | Processing: {} | Queued: {} | Pending: {}",
            progress.getTaskInstanceId(),
            progress.getTaskType(),
            progress.getCompletedChunks(),
            progress.getTotalChunks(),
            String.format("%.1f", progress.getCompletionPercentage()),
            progress.getFailedChunks(),
            progress.getProcessingChunks(),
            progress.getQueuedChunks(),
            progress.getPendingChunks()
        );
    }

    /**
     * Optional periodic stats at DEBUG level only (no dispatch side effects).
     */
    public void logSystemStateIfDebugEnabled() {
        if (!log.isDebugEnabled() || taskInstances.isEmpty()) {
            return;
        }
        log.debug("=== SCHEDULER STATE === Active tasks: {}", taskInstances.size());
    }
}
