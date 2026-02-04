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
 * - TARGET_CHUNKS_PER_CYCLE=8 (number of round-robin passes) keeps workers busy
 * - Scheduling runs every 100ms to maintain optimal queue levels
 * 
 * EXAMPLE BEHAVIOR (4 workers, Tasks A=100 chunks, B=20 chunks):
 * - Initial: Queue A-1, B-1, A-2, B-2 → Workers process all 4 simultaneously
 * - After A-1 completes: Queue A-3, continue rotation
 * - After B-1 completes: Queue B-3, continue rotation
 * - Result: Both A and B progress at equal pace until B finishes
 * - Then: A uses all available workers to finish remaining chunks
 * 
 * NEW TASK ARRIVES (Task C joins while A and B are running):
 * - Before C: A-10 queued, B-10 queued, A-11 processing, B-11 processing
 * - After C arrives: Next rotation includes C
 * - Rotation: A-12, B-12, C-1, A-13, B-13, C-2...
 * - C immediately gets fair share of worker slots
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
    
    /**
     * Maximum chunks to keep queued per task instance to maintain fairness
     * This prevents one task from flooding the queue while others wait
     * UPDATED: Reduced to 1 for true round-robin (each task gets 1 chunk queued at a time)
     */
    private static final int MAX_QUEUED_CHUNKS_PER_TASK = 1;
    
    /**
     * Target number of chunks to publish per scheduling cycle
     * Should be >= number of workers to keep them busy
     * UPDATED: This now represents the number of round-robin passes to make
     * With MAX_QUEUED_CHUNKS_PER_TASK=1, each task gets 1 chunk per pass
     */
    private static final int TARGET_CHUNKS_PER_CYCLE = 8;

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
     * Publishes chunks in STRICT round-robin order across all active task instances
     * 
     * ALGORITHM (TRUE ROUND-ROBIN):
     * 1. Get list of all active task instances
     * 2. Iterate in round-robin order: Task A → Task B → Task C → Task A → Task B → ...
     * 3. For each task in rotation:
     *    - Publish 1 chunk if it has pending work and room in queue
     *    - Skip if no pending chunks or already at queue limit
     * 4. Continue until we've made enough passes to keep workers busy
     * 
     * FAIRNESS WITH CONCURRENT PROCESSING:
     * ====================================
     * This scheduler ensures STRICT fairness by:
     * - Publishing exactly 1 chunk per task per round-robin pass
     * - Limiting queued chunks per task to 1 (MAX_QUEUED_CHUNKS_PER_TASK=1)
     * - Never allowing one task to monopolize workers
     * 
     * Example with 3 tasks (A with 100 chunks, B with 20 chunks, C with 10 chunks) and 4 workers:
     * - Pass 1: Publish A-1, B-1, C-1, A-2 (4 chunks total - fills all 4 workers)
     * - Workers: Worker1→A-1, Worker2→B-1, Worker3→C-1, Worker4→A-2
     * - Pass 2 (after A-1 completes): B-2, C-2, A-3, B-3
     * - Pass 3 (after more complete): C-3, A-4, B-4, C-4
     * - Pass N (after C finishes all 10): A-X, B-Y, A-X+1, B-Y+1 (only A and B remain)
     * 
     * When a new task D arrives:
     * - Immediately enters rotation: A-X, B-Y, D-1, A-X+1, B-Y+1, D-2
     * 
     * This ensures:
     * - All tasks make progress simultaneously
     * - No task waits for another to complete
     * - New tasks get immediate attention
     * - Workers are always busy (if work exists)
     * - Each task gets equal priority regardless of when it arrived
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
                log.info("🔄 STRICT ROUND-ROBIN: {} active tasks being processed fairly", activeInstances.size());
                for (TaskInstance ti : activeInstances) {
                    TaskInstance.TaskProgress progress = ti.getProgress();
                    log.info("  - Task: {} | Type: {} | Guardian: {} | Progress: {}/{} ({:.1f}%) | Processing: {} | Queued: {}", 
                        ti.getTaskInstanceId(), ti.getTaskType(), ti.getGuardianId(),
                        progress.getCompletedChunks(), progress.getTotalChunks(),
                        progress.getCompletionPercentage(),
                        progress.getProcessingChunks(), progress.getQueuedChunks());
                }
            }
            
            // TRUE ROUND-ROBIN: Publish 1 chunk per task per pass, rotating through all tasks
            int startIndex = taskRoundRobinIndex.get() % activeInstances.size();
            int chunksPublished = 0;
            int passCount = 0;
            int maxPasses = TARGET_CHUNKS_PER_CYCLE; // Number of round-robin passes to make
            
            // Make multiple passes through the task list to keep workers busy
            while (passCount < maxPasses) {
                boolean publishedInThisPass = false;
                
                // STRICT ROUND-ROBIN: Process each task once per pass
                for (int i = 0; i < activeInstances.size(); i++) {
                    int index = (startIndex + i) % activeInstances.size();
                    TaskInstance taskInstance = activeInstances.get(index);
                    
                    // Check if this task has room for more queued chunks
                    long currentlyQueued = taskInstance.getChunks().stream()
                        .filter(c -> c.getState() == ChunkState.QUEUED)
                        .count();
                    
                    if (currentlyQueued >= MAX_QUEUED_CHUNKS_PER_TASK) {
                        continue; // This task already has its quota queued
                    }
                    
                    // Get next pending chunk for this task instance
                    Chunk chunk = taskInstance.getNextPendingChunk();
                    if (chunk != null) {
                        publishChunk(chunk, taskInstance.getTaskType());
                        chunksPublished++;
                        publishedInThisPass = true;
                        
                        if (activeInstances.size() > 1) {
                            log.debug("📤 [Pass {}] Published from Task {} (Guardian {}) - Total: {}", 
                                passCount + 1, taskInstance.getTaskInstanceId(), 
                                taskInstance.getGuardianId(), chunksPublished);
                        }
                    }
                }
                
                passCount++;
                
                // If we didn't publish anything in this pass, all tasks are either:
                // - Already at queue limit, or
                // - Have no more pending chunks
                // No point in continuing passes
                if (!publishedInThisPass) {
                    break;
                }
            }
            
            // Update round-robin index for next scheduling cycle
            // Move forward by 1 to ensure different starting point each cycle
            taskRoundRobinIndex.incrementAndGet();
            
            if (chunksPublished > 0) {
                if (activeInstances.size() > 1) {
                    log.info("📤 Published {} chunks across {} tasks in {} passes | STRICT ROUND-ROBIN", 
                        chunksPublished, activeInstances.size(), passCount);
                } else {
                    log.debug("📤 Published {} chunks | Active tasks: {}", 
                        chunksPublished, activeInstances.size());
                }
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
