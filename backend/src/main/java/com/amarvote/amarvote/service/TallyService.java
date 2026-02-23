package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.ChunkConfiguration;
import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionGuardTallyRequest;
import com.amarvote.amarvote.dto.ElectionGuardTallyResponse;
import com.amarvote.amarvote.dto.LockMetadata;
import com.amarvote.amarvote.dto.TallyCreationStatusResponse;
import com.amarvote.amarvote.dto.worker.TallyCreationTask;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TallyService {
    
    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private BallotRepository ballotRepository;
    
    @Autowired
    private ElectionRepository electionRepository;
    
    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;
    
    @Autowired
    private GuardianRepository guardianRepository;
    
    @Autowired
    private SubmittedBallotRepository submittedBallotRepository;
    
    @Autowired
    private ElectionCenterRepository electionCenterRepository;
    
    @Autowired
    private ChunkingService chunkingService;
    
    @Autowired
    private ElectionGuardService electionGuardService;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    // Note: TaskPublisherService is no longer used (replaced by RoundRobinTaskScheduler)
    // Kept for backward compatibility - can be removed in future cleanup
    // @Autowired
    // private TaskPublisherService taskPublisherService;
    
    @Autowired
    private RoundRobinTaskScheduler roundRobinTaskScheduler;
    
    @Autowired
    private RedisLockService redisLockService;
    
    @Autowired
    private ElectionJobRepository jobRepository;

    /**
     * Periodic GC hint and memory monitoring utility
     * Suggests GC when memory usage exceeds threshold, logs progress
     */
    private void suggestGCIfNeeded(int currentChunk, int totalChunks, String phase) {
        Runtime runtime = Runtime.getRuntime();
        long usedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemoryMB = runtime.maxMemory() / (1024 * 1024);
        double usagePercent = (usedMemoryMB * 100.0) / maxMemoryMB;
        
        System.out.printf("📊 Progress [%s]: %d/%d | Memory: %dMB/%dMB (%.1f%%)%n",
            phase, currentChunk, totalChunks, usedMemoryMB, maxMemoryMB, usagePercent);
        
        // Suggest GC only if memory usage is high (above 70%)
        if (usagePercent > 70.0) {
            System.out.println("🗑️ Memory usage high (" + String.format("%.1f", usagePercent) + "%) - Suggesting GC");
            System.gc();
            
            // Log memory after GC
            long usedAfterGC = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            long freedMB = usedMemoryMB - usedAfterGC;
            System.out.println("🧹 GC completed - Freed " + freedMB + " MB");
        }
    }

    /**
     * Get the current tally creation status for an election
     * Queries RoundRobinTaskScheduler for real-time chunk processing state
     */
    public TallyCreationStatusResponse getTallyStatus(Long electionId) {
        // Query ElectionJob for task metadata
        Optional<ElectionJob> jobOpt = jobRepository.findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(electionId, "TALLY");
        String createdBy = jobOpt.map(ElectionJob::getCreatedBy).orElse(null);
        Instant startedAt = jobOpt.map(ElectionJob::getStartedAt).orElse(null);
        
        // Check for active Redis lock
        String lockKey = RedisLockService.buildTallyLockKey(electionId);
        Optional<LockMetadata> lockMetadata = redisLockService.getLockMetadata(lockKey);
        
        // Try to get progress from scheduler first (live task tracking)
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> electionProgress = 
            roundRobinTaskScheduler.getElectionProgress(electionId);
        
        // Filter for tally creation tasks
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> tallyTasks = electionProgress.stream()
            .filter(p -> p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.TALLY_CREATION)
            .collect(Collectors.toList());
        
        if (!tallyTasks.isEmpty()) {
            // Active task found in scheduler - return live progress
            com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress progress = tallyTasks.get(0);
            
            String status;
            if (progress.getCompletedChunks() == 0 && progress.getProcessingChunks() == 0 && progress.getQueuedChunks() == 0) {
                status = "pending";
            } else if (progress.isComplete()) {
                status = "completed";
            } else {
                status = "in_progress";
            }
            
            return TallyCreationStatusResponse.builder()
                .success(true)
                .status(status)
                .message("Tally creation status retrieved successfully")
                .totalChunks((int) progress.getTotalChunks())
                .processedChunks((int) progress.getCompletedChunks())
                .progressPercentage(progress.getCompletionPercentage())
                .createdBy(createdBy)
                .startedAt(startedAt != null ? startedAt.toString() : null)
                .isLocked(lockMetadata.isPresent())
                .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
                .lockStartTime(lockMetadata.map(m -> m.getStartTime().toString()).orElse(null))
                .build();
        }
        
        // No active task in scheduler - check database for completed tally
        List<ElectionCenter> allChunks = electionCenterRepository.findByElectionId(electionId);
        int totalChunks = allChunks.size();
        
        if (totalChunks == 0) {
            return TallyCreationStatusResponse.builder()
                .success(true)
                .status("not_started")
                .message("Tally creation has not been initiated")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .isLocked(lockMetadata.isPresent())
                .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
                .lockStartTime(lockMetadata.map(m -> m.getStartTime().toString()).orElse(null))
                .build();
        }
        
        // Count how many chunks have encrypted_tally filled
        long processedChunks = electionCenterRepository.countByElectionIdAndEncryptedTallyNotNull(electionId);
        
        // Determine status based on progress
        String status;
        if (processedChunks == 0) {
            status = "not_started";
        } else if (processedChunks < totalChunks) {
            // Task not in scheduler but partially complete - might be stale/interrupted
            status = "in_progress";
        } else {
            status = "completed";
        }
        
        double progressPercentage = totalChunks > 0 
            ? (processedChunks * 100.0) / totalChunks
            : 0.0;
        
        return TallyCreationStatusResponse.builder()
            .success(true)
            .status(status)
            .message("Tally creation status retrieved successfully")
            .totalChunks(totalChunks)
            .processedChunks((int) processedChunks)
            .progressPercentage(progressPercentage)
            .createdBy(createdBy)
            .startedAt(startedAt != null ? startedAt.toString() : null)
            .isLocked(lockMetadata.isPresent())
            .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
            .lockStartTime(lockMetadata.map(m -> m.getStartTime().toString()).orElse(null))
            .build();
    }

    /**
     * Initiate tally creation (returns immediately, processes asynchronously)
     */
    public CreateTallyResponse initiateTallyCreation(CreateTallyRequest request, String userEmail) {
        try {
            System.out.println("=== Initiating Tally Creation ===");
            System.out.println("Election ID: " + request.getElection_id() + ", User: " + userEmail);
            
            // 1. Verify election has ended
            Optional<Election> electionOpt = electionRepository.findById(request.getElection_id());
            if (electionOpt.isEmpty()) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            
            Election election = electionOpt.get();
            if (election.getEndingTime().isAfter(Instant.now())) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election has not ended yet. Cannot create tally until election ends.")
                    .build();
            }
            
            // 2. Calculate chunks upfront to return chunk count to frontend
            List<Long> ballotIds = ballotRepository.findBallotIdsByElectionIdAndStatus(request.getElection_id(), "cast");
            if (ballotIds.isEmpty()) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No cast ballots found for this election")
                    .build();
            }
            
            ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballotIds.size());
            int totalChunks = chunkConfig.getNumChunks();
            
            System.out.println("✅ Calculated " + totalChunks + " chunks for " + ballotIds.size() + " ballots");
            
            // 3. Try to acquire Redis lock FIRST
            String lockKey = RedisLockService.buildTallyLockKey(request.getElection_id());
            boolean lockAcquired = redisLockService.tryAcquireLock(
                lockKey,
                userEmail,
                "TALLY_CREATION",
                "Election ID: " + request.getElection_id() + ", Total chunks: " + totalChunks
            );
            
            if (!lockAcquired) {
                // Lock already exists - get metadata to inform user
                Optional<LockMetadata> existingLock = redisLockService.getLockMetadata(lockKey);
                if (existingLock.isPresent()) {
                    LockMetadata metadata = existingLock.get();
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Tally creation is already in progress. Started by " + 
                                metadata.getUserEmail() + " at " + metadata.getStartTime())
                        .encryptedTally("IN_PROGRESS")
                        .build();
                } else {
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Tally creation is already in progress")
                        .encryptedTally("IN_PROGRESS")
                        .build();
                }
            }
            
            // 4. Lock acquired - now check database to see if work already exists
            List<ElectionCenter> existingChunks = electionCenterRepository.findByElectionId(request.getElection_id());
            if (!existingChunks.isEmpty()) {
                long completedChunks = electionCenterRepository.countByElectionIdAndEncryptedTallyNotNull(request.getElection_id());
                
                if (completedChunks > 0 && completedChunks < existingChunks.size()) {
                    // Release lock since work already in progress
                    redisLockService.releaseLock(lockKey);
                    System.out.println("⚠️ Tally creation already in progress");
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Tally creation is already in progress")
                        .encryptedTally("IN_PROGRESS:" + completedChunks + "/" + existingChunks.size())
                        .build();
                } else if (completedChunks == existingChunks.size()) {
                    // Release lock since work already completed
                    redisLockService.releaseLock(lockKey);
                    System.out.println("✅ Tally already exists");
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Tally already exists")
                        .encryptedTally("COMPLETED")
                        .build();
                }
            }
            
            // 5. Start async processing (lock will be held during processing)
            createTallyAsync(request, userEmail);
            
            return CreateTallyResponse.builder()
                .success(true)
                .message("Request accepted. Preparing to process " + totalChunks + " chunks...")
                .encryptedTally("INITIATED:" + totalChunks)
                .build();
                
        } catch (Exception e) {
            System.err.println("❌ Error initiating tally creation: " + e.getMessage());

            return CreateTallyResponse.builder()
                .success(false)
                .message("Failed to initiate tally creation: " + e.getMessage())
                .build();
        }
    }

    /**
     * Asynchronous tally creation with progress tracking
     * NOTE: @Transactional removed from async method to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processChunkTransactional().
    */
    @Async
    public void createTallyAsync(CreateTallyRequest request, String userEmail) {
        Long electionId = request.getElection_id();
        String lockKey = RedisLockService.buildTallyLockKey(electionId);
        
        try {
            System.out.println("=== Async Tally Creation Started (Memory-Efficient Mode) ===");
            System.out.println("Election ID: " + electionId);
            
            // Create ElectionJob record for tracking
            ElectionJob job = ElectionJob.builder()
                .jobId(java.util.UUID.randomUUID())
                .electionId(electionId)
                .operationType("TALLY")
                .status("IN_PROGRESS")
                .totalChunks(0) // Will be updated below
                .processedChunks(0)
                .createdBy(userEmail)
                .startedAt(Instant.now())
                .build();
            jobRepository.save(job);
            System.out.println("✅ Created ElectionJob record for tracking");
            
            // Fetch election
            Optional<Election> electionOpt = electionRepository.findById(electionId);
            if (electionOpt.isEmpty()) {
                throw new RuntimeException("Election not found");
            }
            
            Election election = electionOpt.get();
            
            // MEMORY-EFFICIENT: Fetch only ballot IDs, not full ballot objects
            List<Long> ballotIds = ballotRepository.findBallotIdsByElectionIdAndStatus(electionId, "cast");
            
            if (ballotIds.isEmpty()) {
                throw new RuntimeException("No cast ballots found for this election");
            }
            
            System.out.println("✅ Found " + ballotIds.size() + " ballot IDs (not loading full ballots yet)");
            
            // Calculate chunks based on count
            ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballotIds.size());
            System.out.println("✅ Calculated " + chunkConfig.getNumChunks() + " chunks");
            
            // MEMORY-EFFICIENT: Assign only ballot IDs to chunks (not full Ballot objects)
            java.util.Map<Integer, List<Long>> chunkIdMap = chunkingService.assignIdsToChunks(ballotIds, chunkConfig);
            
            // Fetch election choices (small dataset, OK to keep in memory)
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId);
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            // ✅ MEMORY-EFFICIENT: Use count query instead of loading all guardians
            int numberOfGuardians = guardianRepository.countByElectionId(election.getElectionId());
            
            // ✅ NEW: Register task instance with RoundRobinTaskScheduler
            System.out.println("=== REGISTERING TALLY TASK WITH ROUND-ROBIN SCHEDULER ===");
            
            // Prepare task data for all chunks
            List<String> taskDataList = new ArrayList<>();
            for (java.util.Map.Entry<Integer, List<Long>> entry : chunkIdMap.entrySet()) {
                int chunkNumber = entry.getKey();
                List<Long> chunkBallotIds = entry.getValue();
                
                // Create task message
                TallyCreationTask task = TallyCreationTask.builder()
                    .electionId(electionId)
                    .chunkNumber(chunkNumber)
                    .ballotIds(chunkBallotIds)
                    .partyNames(partyNames)
                    .candidateNames(candidateNames)
                    .jointPublicKey(election.getJointPublicKey())
                    .baseHash(election.getBaseHash())
                    .quorum(election.getElectionQuorum())
                    .numberOfGuardians(numberOfGuardians)
                    .build();
                
                // Serialize task to JSON
                try {
                    String taskJson = objectMapper.writeValueAsString(task);
                    taskDataList.add(taskJson);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to serialize task: " + e.getMessage());
                }
                
                System.out.println("✅ Prepared task for chunk " + chunkNumber + " (" + chunkBallotIds.size() + " ballots)");
            }
            
            // Register with scheduler - scheduler will handle fair round-robin publishing
            String taskInstanceId = roundRobinTaskScheduler.registerTask(
                com.amarvote.amarvote.model.scheduler.TaskType.TALLY_CREATION,
                electionId,
                null, // no guardianId for tally creation
                null, // no sourceGuardianId
                null, // no targetGuardianId
                taskDataList
            );
            
            System.out.println("=== TASK REGISTERED WITH SCHEDULER ===");
            System.out.println("✅ Task Instance ID: " + taskInstanceId);
            System.out.println("✅ Total chunks: " + chunkConfig.getNumChunks());
            System.out.println("Scheduler will publish chunks in fair round-robin order across all active tasks");
            
            /* OLD CODE - Replaced with RabbitMQ queue-based processing
            // ✅ Process each chunk in separate isolated transaction
            int processedChunks = 0;
            for (java.util.Map.Entry<Integer, List<Long>> entry : chunkIdMap.entrySet()) {
                int chunkNumber = entry.getKey();
                List<Long> chunkBallotIds = entry.getValue();
                
                // ✅ Each chunk processed in its own transaction - memory released after completion
                processTallyChunkTransactional(
                    electionId,
                    chunkNumber,
                    chunkBallotIds,
                    partyNames,
                    candidateNames,
                    election.getJointPublicKey(),
                    election.getBaseHash(),
                    election.getElectionQuorum(),
                    numberOfGuardians
                );
                
                processedChunks++;
                
                // ✅ Periodic GC hint every 50 chunks (not every chunk - avoids GC overhead)
                if (processedChunks % 50 == 0 || processedChunks == chunkConfig.getNumChunks()) {
                    suggestGCIfNeeded(processedChunks, chunkConfig.getNumChunks(), "Tally Creation");
                }
                
                System.out.println("✅ Chunk " + chunkNumber + " completed. Progress: " + processedChunks + "/" + chunkConfig.getNumChunks());
            }
            
            // Update election status in separate transaction
            updateElectionStatusTransactional(electionId, "completed");
            */
            
            System.out.println("=== Tally Creation Initiated Successfully ===");
            
        } catch (Exception e) {
            System.err.println("❌ Error in async tally creation: " + e.getMessage());
        } finally {
            // Release Redis lock
            redisLockService.releaseLock(lockKey);
            System.out.println("🔓 Tally creation lock released for election: " + electionId);
        }
    }

    // Removed: processTallyChunkTransactional - superseded by async task worker (TaskWorkerService)
    // Removed: updateTallyStatusTransactional - no longer needed as we query database directly
    
    /**
     * Update election status in separate transaction
     */
    @Transactional
    private void updateElectionStatusTransactional(Long electionId, String status) {
        Optional<Election> electionOpt = electionRepository.findById(electionId);
        if (electionOpt.isPresent()) {
            Election election = electionOpt.get();
            election.setStatus(status);
            electionRepository.save(election);
        }
    }
    
    /**     * Process one tally chunk in isolated transaction (synchronous version)
     * Transaction boundary ensures all entities are released after chunk completion
     */
    @Transactional
    private void processSyncChunkTransactional(
            Long electionId,
            int chunkNumber,
            List<Long> chunkBallotIds,
            List<String> partyNames,
            List<String> candidateNames,
            String jointPublicKey,
            String baseHash,
            int quorum,
            int numberOfGuardians) {
        
        System.out.println("Chunk size: " + chunkBallotIds.size() + " ballots (Transaction Start)");
        
        // Fetch ballots for this chunk
        List<Ballot> chunkBallots = ballotRepository.findByBallotIdIn(chunkBallotIds);
        
        // Create election center entry for this chunk
        ElectionCenter electionCenter = ElectionCenter.builder()
            .electionId(electionId)
            .build();
        electionCenter = electionCenterRepository.save(electionCenter);
        System.out.println("✅ Created election_center entry ID: " + electionCenter.getElectionCenterId());
        
        // Extract cipher texts for this chunk
        List<String> chunkEncryptedBallots = chunkBallots.stream()
            .map(Ballot::getCipherText)
            .collect(Collectors.toList());
        
        // Call ElectionGuard microservice for this chunk
        System.out.println("🚀 CALLING ELECTIONGUARD TALLY SERVICE FOR CHUNK " + chunkNumber);
        ElectionGuardTallyResponse guardResponse = callElectionGuardTallyService(
            partyNames, 
            candidateNames, 
            jointPublicKey, 
            baseHash, 
            chunkEncryptedBallots,
            quorum,
            numberOfGuardians
        );
        
        if (!"success".equals(guardResponse.getStatus())) {
            System.err.println("❌ ELECTIONGUARD SERVICE FAILED FOR CHUNK " + chunkNumber + ": " + guardResponse.getMessage());
            throw new RuntimeException("Failed to create encrypted tally for chunk " + chunkNumber + ": " + guardResponse.getMessage());
        }
        
        System.out.println("✅ ElectionGuard service succeeded for chunk " + chunkNumber);
        
        // Store encrypted tally for this chunk
        String ciphertextTallyJson = toJsonString(guardResponse.getCiphertext_tally());
        electionCenter.setEncryptedTally(ciphertextTallyJson);
        electionCenterRepository.save(electionCenter);
        System.out.println("✅ Encrypted tally saved for chunk " + chunkNumber);
        
        // Save submitted_ballots for this chunk (linked to election_center_id)
        if (guardResponse.getSubmitted_ballots() != null && guardResponse.getSubmitted_ballots().length > 0) {
            System.out.println("Processing " + guardResponse.getSubmitted_ballots().length + " submitted ballots for chunk " + chunkNumber);
            
            int savedCount = 0;
            for (Object submittedBallotRaw : guardResponse.getSubmitted_ballots()) {
                try {
                    String submittedBallotCipherText = toJsonString(submittedBallotRaw);
                    if (submittedBallotCipherText != null &&
                            !submittedBallotRepository.existsByElectionCenterIdAndCipherText(
                            electionCenter.getElectionCenterId(), submittedBallotCipherText)) {
                        SubmittedBallot submittedBallot = SubmittedBallot.builder()
                            .electionCenterId(electionCenter.getElectionCenterId())
                            .cipherText(submittedBallotCipherText)
                            .build();
                        
                        submittedBallotRepository.save(submittedBallot);
                        savedCount++;
                    }
                } catch (Exception e) {
                    System.err.println("Error saving submitted ballot for chunk " + chunkNumber + ": " + e.getMessage());
                }
            }
            
            System.out.println("✅ Saved " + savedCount + " submitted ballots for chunk " + chunkNumber);
        }
        
        // ✅ AGGRESSIVE MEMORY CLEANUP
        entityManager.flush();
        entityManager.clear();
        
        // ✅ Clear large collections; local variables go out of scope at method end
        chunkBallots.clear();
        chunkEncryptedBallots.clear();
        
        // Suggest garbage collection (hint to JVM)
        System.gc();
        
        // Log memory usage
        Runtime runtime = Runtime.getRuntime();
        long usedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        System.out.println("✅ Chunk " + chunkNumber + " transaction complete - All entities detached and cleared");
        System.out.println("🗑️ Memory cleanup: EntityManager cleared, large objects nullified");
        System.out.println("🧠 Current heap usage: " + usedMemoryMB + " MB");
        // Transaction ends here, Hibernate session closes automatically, all entities released from memory
    }
    
    /**     * NOTE: @Transactional removed to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processSyncChunkTransactional().
     */
    public CreateTallyResponse createTally(CreateTallyRequest request, String userEmail, boolean bypassEndTimeCheck) {
        try {
            System.out.println("=== TallyService.createTally START ===");
            System.out.println("Creating tally for election ID: " + request.getElection_id() + " by user: " + userEmail);
            
            // Fetch election details
            Optional<Election> electionOpt = electionRepository.findById(request.getElection_id());
            if (!electionOpt.isPresent()) {
                System.err.println("Election not found: " + request.getElection_id());
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            
            Election election = electionOpt.get();
            System.out.println("Election found: " + election.getElectionTitle());
            System.out.println("Election ending time: " + election.getEndingTime());
            System.out.println("Current time: " + Instant.now());
            
            // Check if user is authorized (admin of the election)
            // if (!election.getAdminEmail().equals(userEmail)) {
            //     return CreateTallyResponse.builder()
            //         .success(false)
            //         .message("You are not authorized to create tally for this election")
            //         .build();
            // }
            
            // Check if election has ended (ending time has passed)
            if (!bypassEndTimeCheck && election.getEndingTime().isAfter(Instant.now())) {
                System.err.println("Election has not ended yet. Ending time: " + election.getEndingTime() + ", Current time: " + Instant.now());
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election has not ended yet. Cannot create tally until election ends.")
                    .build();
            }
            
            if (bypassEndTimeCheck) {
                System.out.println("Bypassing election end time check for auto-creation during partial decryption");
            } else {
                System.out.println("Election has ended, proceeding with tally creation");
            }
            
            // Check if encrypted tally already exists (check election_center table)
            List<ElectionCenter> existingChunks = electionCenterRepository.findByElectionId(request.getElection_id());
            if (!existingChunks.isEmpty()) {
                System.out.println("Encrypted tally already exists for election (chunks found): " + request.getElection_id());
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Encrypted tally already calculated")
                    .encryptedTally("Chunked tallies exist in election_center table")
                    .build();
            }
            
            // CAST ballots for this election
            System.out.println("=== FETCHING CAST BALLOTS FOR TALLY ===");
            List<Ballot> ballots = ballotRepository.findByElectionIdAndStatus(request.getElection_id(), "cast");
            System.out.println("Found " + ballots.size() + " cast ballots in Ballot table");
            
            if (ballots.isEmpty()) {
                System.err.println("❌ NO CAST BALLOTS AVAILABLE FOR TALLY CREATION");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No cast ballots found for this election")
                    .build();
            }
            
            // ===== CHUNKING LOGIC START =====
            System.out.println("=== CALCULATING CHUNKS ===");
            ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballots.size());
            System.out.println("✅ Chunks calculated: " + chunkConfig.getNumChunks() + " chunks");
            System.out.println("Chunk sizes: " + chunkConfig.getChunkSizes());
            
            // Assign ballots to chunks randomly
            java.util.Map<Integer, List<Ballot>> chunks = chunkingService.assignBallotsToChunks(ballots, chunkConfig);
            System.out.println("✅ Ballots assigned to chunks");
            
            // Verify assignment
            if (!chunkingService.verifyChunkAssignment(ballots, chunks)) {
                System.err.println("❌ CHUNK ASSIGNMENT VERIFICATION FAILED");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Internal error: Chunk assignment verification failed")
                    .build();
            }
            System.out.println("✅ Chunk assignment verified");
            
            // Fetch election choices ONCE (same for all chunks)
            System.out.println("=== FETCHING ELECTION CHOICES ===");
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.getElection_id());
            System.out.println("Found " + electionChoices.size() + " election choices");
            
            if (electionChoices.isEmpty()) {
                System.err.println("❌ NO ELECTION CHOICES FOUND");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No election choices found for this election")
                    .build();
            }
            
            // Extract party names and candidate names (same for all chunks)
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
            
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            System.out.println("✅ Party names (" + partyNames.size() + "): " + partyNames);
            System.out.println("✅ Candidate names (" + candidateNames.size() + "): " + candidateNames);
            
            // ✅ MEMORY-EFFICIENT: Use count query instead of loading all guardians
            int numberOfGuardians = guardianRepository.countByElectionId(election.getElectionId());
            System.out.println("Number of Guardians: " + numberOfGuardians);
            
            // ✅ Process each chunk in separate isolated transaction
            int processedSyncChunks = 0;
            for (java.util.Map.Entry<Integer, List<Ballot>> entry : chunks.entrySet()) {
                int chunkNumber = entry.getKey();
                List<Ballot> chunkBallots = entry.getValue();
                
                System.out.println("=== PROCESSING CHUNK " + chunkNumber + " ===");
                
                // Extract ballot IDs from chunk ballots
                List<Long> chunkBallotIds = chunkBallots.stream()
                    .map(Ballot::getBallotId)
                    .collect(Collectors.toList());
                
                // ✅ Process chunk in isolated transaction - memory released after completion
                processSyncChunkTransactional(
                    request.getElection_id(),
                    chunkNumber,
                    chunkBallotIds,
                    partyNames,
                    candidateNames,
                    election.getJointPublicKey(),
                    election.getBaseHash(),
                    election.getElectionQuorum(),
                    numberOfGuardians
                );
                
                processedSyncChunks++;
                
                // ✅ Periodic GC hint every 50 chunks (not every chunk - avoids GC overhead)
                if (processedSyncChunks % 50 == 0 || processedSyncChunks == chunkConfig.getNumChunks()) {
                    suggestGCIfNeeded(processedSyncChunks, chunkConfig.getNumChunks(), "Tally Creation (Sync)");
                }
            }
            // ===== CHUNKING LOGIC END =====
            
            // Update election status to completed in separate transaction
            updateElectionStatusTransactional(request.getElection_id(), "completed");
            
            System.out.println("=== TALLY CREATION COMPLETED SUCCESSFULLY ===");
            System.out.println("✅ Created " + chunkConfig.getNumChunks() + " chunks for election: " + request.getElection_id());
            
            return CreateTallyResponse.builder()
                .success(true)
                .message("Encrypted tally created successfully with " + chunkConfig.getNumChunks() + " chunks")
                .encryptedTally("Chunked tallies stored in election_center table")
                .build();
                
        } catch (Exception e) {
            System.err.println("❌ EXCEPTION in TallyService.createTally(): " + e.getMessage());
            return CreateTallyResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }
    
    private ElectionGuardTallyResponse callElectionGuardTallyService(
            List<String> partyNames, List<String> candidateNames, 
            String jointPublicKey, String commitmentHash, List<String> encryptedBallots,
            int quorum, int numberOfGuardians) {
        
        System.out.println("=== CALLING ELECTIONGUARD MICROSERVICE ===");
        System.out.println("Service endpoint: /create_encrypted_tally");
        System.out.println("Party names count: " + partyNames.size());
        System.out.println("Candidate names count: " + candidateNames.size());
        System.out.println("Encrypted ballots count: " + encryptedBallots.size());
        System.out.println("Quorum: " + quorum);
        System.out.println("Number of guardians: " + numberOfGuardians);
        
        try {
            String url = "/create_encrypted_tally";
            
            ElectionGuardTallyRequest request = ElectionGuardTallyRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .joint_public_key(jointPublicKey)
                .commitment_hash(commitmentHash)
                .encrypted_ballots(encryptedBallots)
                .number_of_guardians(numberOfGuardians)
                .quorum(quorum)
                .build();

            System.out.println("🚀 Sending request to ElectionGuard service at: " + url);
            System.out.println("Request prepared successfully");
            
            String response = electionGuardService.postRequest(url, request);
            
            System.out.println("✅ Received response from ElectionGuard tally service");
            System.out.println("Response received (length: " + (response != null ? response.length() : 0) + " chars)");
            
            if (response == null) {
                System.err.println("❌ NULL response from ElectionGuard service");
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            ElectionGuardTallyResponse parsedResponse = objectMapper.readValue(response, ElectionGuardTallyResponse.class);
            System.out.println("✅ Response parsed successfully");
            return parsedResponse;
        } catch (Exception e) {
            System.err.println("❌ EXCEPTION in ElectionGuard service call: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }

    /**
     * Utility method to remove duplicate submitted ballots for an election
     * This can be called if duplicates are found in the database
     * NOTE: @Transactional removed to prevent memory issues with loops.
     * Consider processing ballots in smaller batches if needed.
     */
    public void removeDuplicateSubmittedBallots(Integer electionId) {
        try {
            // TODO: Update to work with chunks - SubmittedBallot now uses election_center_id
            // List<SubmittedBallot> allBallots = submittedBallotRepository.findByElectionCenterId(electionCenterId);
            List<SubmittedBallot> allBallots = submittedBallotRepository.findAll(); // Temporary workaround
            
            // Group by cipher_text and keep only the first occurrence (earliest created)
            List<SubmittedBallot> ballotsToDelete = allBallots.stream()
                .collect(Collectors.groupingBy(SubmittedBallot::getCipherText))
                .values()
                .stream()
                .filter(group -> group.size() > 1) // Only groups with duplicates
                .flatMap(group -> {
                    // Sort by ID (assuming lower ID means earlier creation) and skip the first
                    return group.stream()
                            .sorted((a, b) -> a.getSubmittedBallotId().compareTo(b.getSubmittedBallotId()))
                            .skip(1);
                })
                .collect(Collectors.toList());
            
            if (!ballotsToDelete.isEmpty()) {
                System.out.println("Deleting " + ballotsToDelete.size() + " duplicate submitted ballots");
                deleteDuplicateBallotsTransactional(ballotsToDelete);
            } else {
                System.out.println("No duplicate submitted ballots found for election: " + electionId);
            }
        } catch (Exception e) {
            System.err.println("Error removing duplicate submitted ballots for election " + electionId + ": " + e.getMessage());
            throw new RuntimeException("Failed to remove duplicate submitted ballots", e);
        }
    }

    /**
     * Delete duplicate ballots in a single transaction
     */
    @Transactional
    private void deleteDuplicateBallotsTransactional(List<SubmittedBallot> ballotsToDelete) {
        submittedBallotRepository.deleteAll(ballotsToDelete);
        System.out.println("✅ Deleted " + ballotsToDelete.size() + " duplicate submitted ballots");
    }
    /**
     * Serialize a microservice response value to a JSON string for DB storage.
     */
    private String toJsonString(Object value) {
        if (value == null) return null;
        if (value instanceof String s) return s;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return value.toString();
        }
    }
}
