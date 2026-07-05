package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
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
import com.amarvote.amarvote.model.ProcessOperationType;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.model.scheduler.TaskType;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.repository.TallyWorkerLogRepository;
import java.util.HashSet;
import java.util.Set;
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
    private ElectionService electionService;
    
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

    @Autowired
    private ProcessCancellationService cancellationService;

    @Autowired
    private TallyWorkerLogRepository tallyWorkerLogRepository;

    @Autowired
    private AsyncTaskDispatcher asyncTaskDispatcher;

    private int getExpectedTallyChunkCount(Long electionId) {
        List<Long> ballotIds = ballotRepository.findBallotIdsByElectionIdAndStatus(electionId, "cast");
        if (ballotIds.isEmpty()) {
            return 0;
        }
        return chunkingService.calculateChunks(ballotIds.size()).getNumChunks();
    }

    private boolean hasActiveTallySchedulerTasks(Long electionId) {
        return roundRobinTaskScheduler.getElectionProgress(electionId).stream()
            .anyMatch(p -> p.getTaskType() == TaskType.TALLY_CREATION && p.isActive());
    }

    /**
     * Periodic GC hint and memory monitoring utility
     * Suggests GC when memory usage exceeds threshold, logs progress
     */
    private void suggestGCIfNeeded(int currentChunk, int totalChunks, String phase) {
        Runtime runtime = Runtime.getRuntime();
        long usedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemoryMB = runtime.maxMemory() / (1024 * 1024);
        double usagePercent = (usedMemoryMB * 100.0) / maxMemoryMB;

        if (usagePercent > 70.0) {
            System.gc();
        }
    }

    /**
     * Get the current tally creation status for an election
     * Queries RoundRobinTaskScheduler for real-time chunk processing state
     */
    public TallyCreationStatusResponse getTallyStatus(Long electionId) {
        Optional<ElectionJob> jobOpt = jobRepository.findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(electionId, "TALLY");
        String createdBy = jobOpt.map(ElectionJob::getCreatedBy).orElse(null);
        Instant startedAt = jobOpt.map(ElectionJob::getStartedAt).orElse(null);

        String lockKey = RedisLockService.buildTallyLockKey(electionId);
        Optional<LockMetadata> lockMetadata = redisLockService.getLockMetadata(lockKey);

        int expectedTotal = getExpectedTallyChunkCount(electionId);
        long dbProcessed = electionCenterRepository.countByElectionIdAndEncryptedTallyNotNull(electionId);
        boolean stopRequested = cancellationService.isTallyStopped(electionId);

        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> tallyTasks =
            roundRobinTaskScheduler.getElectionProgress(electionId).stream()
                .filter(p -> p.getTaskType() == TaskType.TALLY_CREATION)
                .collect(Collectors.toList());

        int totalChunks = expectedTotal > 0 ? expectedTotal : tallyTasks.isEmpty()
            ? (int) electionCenterRepository.findByElectionId(electionId).size()
            : (int) tallyTasks.get(0).getTotalChunks();
        int processedChunks = (int) dbProcessed;

        String status;
        if (totalChunks == 0 && processedChunks == 0) {
            status = "not_started";
        } else if (processedChunks >= totalChunks && totalChunks > 0) {
            status = "completed";
        } else if (stopRequested || tallyTasks.stream().anyMatch(com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress::isStopped)) {
            status = "stopped";
        } else if (tallyTasks.stream().anyMatch(com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress::isActive)
            || processedChunks > 0) {
            status = "in_progress";
        } else if (processedChunks == 0) {
            status = "not_started";
        } else {
            status = "in_progress";
        }

        double progressPercentage = totalChunks > 0
            ? (processedChunks * 100.0) / totalChunks
            : 0.0;

        return TallyCreationStatusResponse.builder()
            .success(true)
            .status(status)
            .message("Tally creation status retrieved successfully")
            .totalChunks(totalChunks)
            .processedChunks(processedChunks)
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
            
            // 1. Verify election has ended
            Optional<Election> electionOpt = electionRepository.findById(request.getElection_id());
            if (electionOpt.isEmpty()) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            
            Election election = electionOpt.get();
            if (!electionService.isElectionAdmin(election, userEmail)) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Only the election admin or co-admins can create a tally")
                    .build();
            }
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
            

            long completedChunks = electionCenterRepository.countByElectionIdAndEncryptedTallyNotNull(request.getElection_id());
            if (completedChunks >= totalChunks && totalChunks > 0) {
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Tally already exists")
                    .encryptedTally("COMPLETED")
                    .build();
            }

            if (hasActiveTallySchedulerTasks(request.getElection_id())) {
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Tally creation is already in progress")
                    .encryptedTally("IN_PROGRESS")
                    .build();
            }

            // Try to acquire Redis lock only when we are about to start (or resume) work
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
            
            // 4. Lock acquired - clean up stale jobs if scheduler has no live tasks

            if (jobRepository.existsActiveJob(request.getElection_id(), "TALLY")) {
                List<ElectionJob> staleJobs = jobRepository.findByElectionIdOrderByStartedAtDesc(request.getElection_id())
                    .stream()
                    .filter(j -> ("IN_PROGRESS".equals(j.getStatus()) || "QUEUED".equals(j.getStatus()))
                        && "TALLY".equals(j.getOperationType()))
                    .collect(java.util.stream.Collectors.toList());
                for (ElectionJob staleJob : staleJobs) {
                    staleJob.setStatus("FAILED");
                    staleJob.setErrorMessage("Marked FAILED: process exited without completing (no active scheduler tasks found on re-check)");
                    staleJob.setCompletedAt(Instant.now());
                    jobRepository.save(staleJob);
                }
            }

            if (hasActiveTallySchedulerTasks(request.getElection_id())) {
                redisLockService.releaseLock(lockKey);
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Tally creation is already in progress")
                    .encryptedTally("IN_PROGRESS")
                    .build();
            }

            if (completedChunks > 0 || cancellationService.isTallyStopped(request.getElection_id())) {
                roundRobinTaskScheduler.removeTasks(
                    TaskType.TALLY_CREATION,
                    request.getElection_id(),
                    null,
                    null,
                    null
                );
                cancellationService.clearStop(request.getElection_id(), ProcessOperationType.TALLY, null);
            }

            asyncTaskDispatcher.run(() -> createTallyAsync(request, userEmail, totalChunks, completedChunks > 0));
            
            String resumeMessage = completedChunks > 0
                ? "Resuming tally creation. Processing remaining chunks (" + completedChunks + "/" + totalChunks + " complete)..."
                : "Request accepted. Preparing to process " + totalChunks + " chunks...";

            return CreateTallyResponse.builder()
                .success(true)
                .message(resumeMessage)
                .encryptedTally(completedChunks > 0 ? "RESUMING:" + completedChunks + "/" + totalChunks : "INITIATED:" + totalChunks)
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
    public void createTallyAsync(CreateTallyRequest request, String userEmail) {
        createTallyAsync(request, userEmail, null, false);
    }

    public void createTallyAsync(CreateTallyRequest request, String userEmail, Integer knownTotalChunks, boolean resume) {
        Long electionId = request.getElection_id();
        String lockKey = RedisLockService.buildTallyLockKey(electionId);
        
        try {
            
            ElectionJob job = ElectionJob.builder()
                .jobId(java.util.UUID.randomUUID())
                .electionId(electionId)
                .operationType("TALLY")
                .status("IN_PROGRESS")
                .totalChunks(knownTotalChunks != null ? knownTotalChunks : 0)
                .processedChunks((int) electionCenterRepository.countByElectionIdAndEncryptedTallyNotNull(electionId))
                .createdBy(userEmail)
                .startedAt(Instant.now())
                .build();
            jobRepository.save(job);
            
            Optional<Election> electionOpt = electionRepository.findById(electionId);
            if (electionOpt.isEmpty()) {
                throw new RuntimeException("Election not found");
            }
            
            Election election = electionOpt.get();
            
            List<Long> ballotIds = ballotRepository.findBallotIdsByElectionIdAndStatus(electionId, "cast");
            
            if (ballotIds.isEmpty()) {
                throw new RuntimeException("No cast ballots found for this election");
            }
            
            
            ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballotIds.size());
            
            java.util.Map<Integer, List<Long>> chunkIdMap = chunkingService.assignIdsToChunks(ballotIds, chunkConfig);
            
            Set<Integer> completedChunkNumbers = new HashSet<>(
                tallyWorkerLogRepository.findCompletedChunkNumbersByElectionId(electionId)
            );
            if (!completedChunkNumbers.isEmpty()) {
            }
            
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId);
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            int numberOfGuardians = guardianRepository.countByElectionId(election.getElectionId());
            
            
            List<String> taskDataList = new ArrayList<>();
            for (java.util.Map.Entry<Integer, List<Long>> entry : chunkIdMap.entrySet()) {
                int chunkNumber = entry.getKey();
                if (completedChunkNumbers.contains(chunkNumber)) {
                    continue;
                }
                List<Long> chunkBallotIds = entry.getValue();
                
                Integer electionMaxChoices = election.getMaxChoices();
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
                    .maxChoices(electionMaxChoices != null ? electionMaxChoices : 1)
                    .build();
                
                try {
                    String taskJson = objectMapper.writeValueAsString(task);
                    taskDataList.add(taskJson);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to serialize task: " + e.getMessage());
                }
                
            }

            if (taskDataList.isEmpty()) {
                job.setStatus("COMPLETED");
                job.setCompletedAt(Instant.now());
                job.setProcessedChunks(chunkConfig.getNumChunks());
                job.setTotalChunks(chunkConfig.getNumChunks());
                jobRepository.save(job);
                return;
            }
            
            String taskInstanceId = roundRobinTaskScheduler.registerTask(
                TaskType.TALLY_CREATION,
                electionId,
                null,
                null,
                null,
                taskDataList
            );
            
            
            
        } catch (Exception e) {
            System.err.println("❌ Error in async tally creation: " + e.getMessage());
        } finally {
            redisLockService.releaseLock(lockKey);
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
        
        
        // Fetch ballots for this chunk
        List<Ballot> chunkBallots = ballotRepository.findByBallotIdIn(chunkBallotIds);
        
        // Create election center entry for this chunk
        ElectionCenter electionCenter = ElectionCenter.builder()
            .electionId(electionId)
            .build();
        electionCenter = electionCenterRepository.save(electionCenter);
        
        // Extract cipher texts for this chunk
        List<String> chunkEncryptedBallots = chunkBallots.stream()
            .map(Ballot::getCipherText)
            .collect(Collectors.toList());
        
        // Call ElectionGuard microservice for this chunk
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
        
        
        // Store encrypted tally for this chunk
        String ciphertextTallyJson = toJsonString(guardResponse.getCiphertext_tally());
        electionCenter.setEncryptedTally(ciphertextTallyJson);
        electionCenterRepository.saveAndFlush(electionCenter);
        
        // Save submitted_ballots for this chunk (linked to election_center_id)
        if (guardResponse.getSubmitted_ballots() != null && guardResponse.getSubmitted_ballots().length > 0) {
            
            Long centerId = electionCenter.getElectionCenterId();
            List<SubmittedBallot> submittedBallots = new ArrayList<>();
            int savedCount = 0;
            for (Object submittedBallotRaw : guardResponse.getSubmitted_ballots()) {
                try {
                    String submittedBallotCipherText = toJsonString(submittedBallotRaw);
                    if (submittedBallotCipherText != null &&
                            !submittedBallotRepository.existsByElectionCenterIdAndCipherText(
                            centerId, submittedBallotCipherText)) {
                        submittedBallots.add(SubmittedBallot.builder()
                            .electionCenterId(centerId)
                            .cipherText(submittedBallotCipherText)
                            .build());
                        savedCount++;
                    }
                } catch (Exception e) {
                    System.err.println("Error preparing submitted ballot for chunk " + chunkNumber + ": " + e.getMessage());
                }
            }
            if (!submittedBallots.isEmpty()) {
                submittedBallotRepository.saveAll(submittedBallots);
            }
            
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
        // Transaction ends here, Hibernate session closes automatically, all entities released from memory
    }
    
    /**     * NOTE: @Transactional removed to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processSyncChunkTransactional().
     */
    public CreateTallyResponse createTally(CreateTallyRequest request, String userEmail, boolean bypassEndTimeCheck) {
        try {
            
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
            } else {
            }
            
            long completedTallyChunks = electionCenterRepository.countByElectionIdAndEncryptedTallyNotNull(request.getElection_id());
            if (completedTallyChunks > 0) {
                int expectedChunks = getExpectedTallyChunkCount(request.getElection_id());
                if (expectedChunks > 0 && completedTallyChunks >= expectedChunks) {
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Encrypted tally already calculated")
                        .encryptedTally("Chunked tallies exist in election_center table")
                        .build();
                }
            }
            
            // CAST ballots for this election
            List<Ballot> ballots = ballotRepository.findByElectionIdAndStatus(request.getElection_id(), "cast");
            
            if (ballots.isEmpty()) {
                System.err.println("❌ NO CAST BALLOTS AVAILABLE FOR TALLY CREATION");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No cast ballots found for this election")
                    .build();
            }
            
            // ===== CHUNKING LOGIC START =====
            ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballots.size());
            
            // Assign ballots to chunks randomly
            java.util.Map<Integer, List<Ballot>> chunks = chunkingService.assignBallotsToChunks(ballots, chunkConfig);
            
            // Verify assignment
            if (!chunkingService.verifyChunkAssignment(ballots, chunks)) {
                System.err.println("❌ CHUNK ASSIGNMENT VERIFICATION FAILED");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Internal error: Chunk assignment verification failed")
                    .build();
            }
            
            // Fetch election choices ONCE (same for all chunks)
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.getElection_id());
            
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
            
            
            // ✅ MEMORY-EFFICIENT: Use count query instead of loading all guardians
            int numberOfGuardians = guardianRepository.countByElectionId(election.getElectionId());
            
            // ✅ Process each chunk in separate isolated transaction
            int processedSyncChunks = 0;
            for (java.util.Map.Entry<Integer, List<Ballot>> entry : chunks.entrySet()) {
                int chunkNumber = entry.getKey();
                List<Ballot> chunkBallots = entry.getValue();
                
                
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

            
            String response = electionGuardService.postRequest(url, request);
            
            
            if (response == null) {
                System.err.println("❌ NULL response from ElectionGuard service");
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            ElectionGuardTallyResponse parsedResponse = objectMapper.readValue(response, ElectionGuardTallyResponse.class);
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
                deleteDuplicateBallotsTransactional(ballotsToDelete);
            } else {
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
