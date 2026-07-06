package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.CombinePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CombineStatusResponse;
import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.DecryptionStatusResponse;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesRequest;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesResponse;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionResponse;
import com.amarvote.amarvote.dto.LockMetadata;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.ProcessOperationType;
import com.amarvote.amarvote.model.scheduler.TaskType;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PartialDecryptionService {

    @PersistenceContext
    private EntityManager entityManager;

    private final GuardianRepository guardianRepository;
    private final ElectionRepository electionRepository;
    private final ElectionService electionService;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final DecryptionRepository decryptionRepository;
    private final ObjectMapper objectMapper;
    private final ElectionGuardCryptoService cryptoService;
    private final AsyncTaskDispatcher asyncTaskDispatcher;
    
    @Autowired
    private ElectionGuardService electionGuardService;
    
    @Autowired
    private DecryptionTaskQueueService decryptionTaskQueueService;
    
    @Autowired
    private CredentialCacheService credentialCacheService;
    
    @Autowired
    private RedisLockService redisLockService;
    
    @Autowired
    private com.amarvote.amarvote.repository.ElectionJobRepository jobRepository;

    @Autowired
    private ProcessCancellationService cancellationService;

    private boolean hasActiveDecryptionSchedulerTasks(Long electionId, Long guardianId) {
        return decryptionTaskQueueService.getRoundRobinTaskScheduler().getElectionProgress(electionId).stream()
            .anyMatch(p -> p.isActive()
                && (p.getTaskType() == TaskType.PARTIAL_DECRYPTION || p.getTaskType() == TaskType.COMPENSATED_DECRYPTION)
                && (java.util.Objects.equals(guardianId, p.getGuardianId())
                    || java.util.Objects.equals(guardianId, p.getSourceGuardianId())));
    }

    private boolean hasActiveCombineSchedulerTasks(Long electionId) {
        return decryptionTaskQueueService.getRoundRobinTaskScheduler().getElectionProgress(electionId).stream()
            .anyMatch(p -> p.getTaskType() == TaskType.COMBINE_DECRYPTION && p.isActive());
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
     * Legacy endpoint — delegates to the async RabbitMQ queue path so ElectionGuard workers stay saturated.
     */
    public CreatePartialDecryptionResponse createPartialDecryption(CreatePartialDecryptionRequest request, String userEmail) {
        return initiateDecryption(request, userEmail);
    }

    /**
     * Initiate decryption process (returns immediately, processes asynchronously)
     */
    public CreatePartialDecryptionResponse initiateDecryption(CreatePartialDecryptionRequest request, String userEmail) {
        try {
            
            // 1. Find guardian record
            List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(request.election_id(), userEmail);
            if (guardians.isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("User is not a guardian for this election")
                    .build();
            }
            Guardian guardian = guardians.get(0);
            
            // 2. Check if tally exists
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
            if (electionCenters.isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Tally has not been created yet. Please create the tally before submitting guardian keys.")
                    .build();
            }
            
            // 3. Try to acquire Redis lock FIRST
            String lockKey = RedisLockService.buildDecryptionLockKey(
                request.election_id(), 
                String.valueOf(guardian.getGuardianId())
            );
            boolean lockAcquired = redisLockService.tryAcquireLock(
                lockKey,
                userEmail,
                "GUARDIAN_DECRYPTION",
                "Election ID: " + request.election_id() + 
                ", Guardian ID: " + guardian.getGuardianId() + 
                ", Guardian Email: " + guardian.getUserEmail()
            );
            
            if (!lockAcquired) {
                // Lock already exists - get metadata to inform user
                Optional<LockMetadata> existingLock = redisLockService.getLockMetadata(lockKey);
                if (existingLock.isPresent()) {
                    LockMetadata metadata = existingLock.get();
                    return CreatePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Decryption is already in progress. Started by " + 
                                metadata.getUserEmail() + " at " + metadata.getStartTime())
                        .build();
                } else {
                    return CreatePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Decryption is already in progress")
                        .build();
                }
            }
            
            try {
                // 4. Lock acquired - now check database to see if work already exists

                // 4a. Check for an active ElectionJob (IN_PROGRESS or QUEUED).
                // If one exists AND the scheduler has live tasks → genuinely in-flight, reject.
                // If one exists but no live tasks → stale record, clean it up and proceed.
                String decryptionOpType = "DECRYPTION_" + guardian.getGuardianId();
                if (jobRepository.existsActiveJob(request.election_id(), decryptionOpType)) {
                    Long guardianIdVal = guardian.getGuardianId();
                    boolean hasLiveDecryptionTasks = hasActiveDecryptionSchedulerTasks(request.election_id(), guardian.getGuardianId());

                    if (hasLiveDecryptionTasks) {
                        redisLockService.releaseLock(lockKey);
                        return CreatePartialDecryptionResponse.builder()
                            .success(true)
                            .message("Decryption is already in progress")
                            .build();
                    }

                    // Stale: mark old jobs FAILED so they don't block future requests
                    jobRepository.findByElectionIdOrderByStartedAtDesc(request.election_id())
                        .stream()
                        .filter(j -> ("IN_PROGRESS".equals(j.getStatus()) || "QUEUED".equals(j.getStatus()))
                            && decryptionOpType.equals(j.getOperationType()))
                        .forEach(j -> {
                            j.setStatus("FAILED");
                            j.setErrorMessage("Marked FAILED: process exited without completing (no active scheduler tasks on re-check)");
                            j.setCompletedAt(java.time.Instant.now());
                            jobRepository.save(j);
                        });
                }

                // 4b. Check existing decryption records in database
                List<Long> allChunks = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(request.election_id());
                long completedPartial = decryptionRepository.countByElectionIdAndGuardianId(request.election_id(), guardian.getGuardianId());
                List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
                int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);
                
                if (completedPartial > 0 && completedPartial < allChunks.size()) {
                    if (hasActiveDecryptionSchedulerTasks(request.election_id(), guardian.getGuardianId())) {
                        redisLockService.releaseLock(lockKey);
                        return CreatePartialDecryptionResponse.builder()
                            .success(true)
                            .message("Decryption is already in progress")
                            .build();
                    }
                    decryptionTaskQueueService.getRoundRobinTaskScheduler().removeTasks(
                        TaskType.PARTIAL_DECRYPTION, request.election_id(), guardian.getGuardianId(), null, null);
                    decryptionTaskQueueService.getRoundRobinTaskScheduler().removeTasks(
                        TaskType.COMPENSATED_DECRYPTION, request.election_id(), null, guardian.getGuardianId(), null);
                    cancellationService.clearStop(request.election_id(), ProcessOperationType.PARTIAL_DECRYPTION, guardian.getGuardianId());
                    cancellationService.clearStop(request.election_id(), ProcessOperationType.COMPENSATED_DECRYPTION, guardian.getGuardianId());
                }
                
                if (completedPartial >= allChunks.size()) {
                    // Check if compensated shares are also done (if multi-guardian)
                    if (totalCompensatedGuardians > 0) {
                        long completedCompensated = compensatedDecryptionRepository
                            .countByElectionIdAndCompensatingGuardianId(request.election_id(), guardian.getGuardianId());
                        long expectedCompensated = (long) allChunks.size() * totalCompensatedGuardians;
                        
                        if (completedCompensated >= expectedCompensated) {
                            // Release lock since work already completed
                            redisLockService.releaseLock(lockKey);
                            return CreatePartialDecryptionResponse.builder()
                                .success(true)
                                .message("Decryption already completed for this guardian")
                                .build();
                        }
                    } else {
                        // Release lock since work already completed
                        redisLockService.releaseLock(lockKey);
                        return CreatePartialDecryptionResponse.builder()
                            .success(true)
                            .message("Decryption already completed for this guardian")
                            .build();
                    }
                }
                
                // 5. Validate credentials BEFORE starting async processing
                try {
                    String guardianCredentials = guardian.getCredentials();
                    if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
                        redisLockService.releaseLock(lockKey);
                        return CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Guardian credentials not found in database. Please contact administrator.")
                            .build();
                    }
                    
                    // Try to decrypt the credentials to validate them
                    ElectionGuardCryptoService.GuardianDecryptionResult validationResult = 
                        cryptoService.decryptGuardianData(request.encrypted_data(), guardianCredentials);
                    
                    if (validationResult == null || 
                        validationResult.getPrivateKey() == null || 
                        validationResult.getPrivateKey().trim().isEmpty()) {
                        redisLockService.releaseLock(lockKey);
                        return CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Please submit the right key")
                            .build();
                    }
                
                } catch (Exception validationError) {
                    System.err.println("❌ Credential validation failed: " + validationError.getMessage());
                    redisLockService.releaseLock(lockKey);
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Please submit the right key")
                        .build();
                }
                
                
                // 8. Start async processing (credentials already validated)
                asyncTaskDispatcher.run(() -> processDecryptionAsync(request, userEmail, guardian));
                
                return CreatePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Credentials received successfully! Your decryption is being processed...")
                    .build();
                    
            } catch (Exception e) {
                // Release lock on error
                redisLockService.releaseLock(lockKey);
                throw e;
            }
            
        } catch (Exception e) {
            System.err.println("Error initiating decryption: " + e.getMessage());
            // Stack trace available in exception: e
            return CreatePartialDecryptionResponse.builder()
                .success(false)
                .message(isCredentialOrDecryptFailure(e) ? "Please submit the right key" : "Failed to initiate decryption: " + e.getMessage())
                .build();
        }
    }

    private boolean isCredentialOrDecryptFailure(Exception e) {
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("decrypt") || lower.contains("credential") || lower.contains("bad request");
    }

    /**
     * Get current decryption status for a guardian by user email
     */
    public DecryptionStatusResponse getDecryptionStatusByEmail(Long electionId, String userEmail) {
        // Find guardian by email and election
        Optional<Guardian> guardianOpt = guardianRepository.findByUserEmailAndElectionId(userEmail, electionId);
        
        if (guardianOpt.isEmpty()) {
            return DecryptionStatusResponse.builder()
                .success(false)
                .status("not_found")
                .message("Guardian not found for this election")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .build();
        }
        
        Guardian guardian = guardianOpt.get();
        return getDecryptionStatus(electionId, guardian.getGuardianId());
    }

    /**
     * Progress for every guardian in an election — used by voters/admins clicking guardian profiles.
     */
    public List<com.amarvote.amarvote.dto.GuardianDecryptionProgressItem> getAllGuardiansDecryptionProgress(Long electionId) {
        return guardianRepository.findByElectionId(electionId).stream()
            .map(guardian -> {
                DecryptionStatusResponse status = getDecryptionStatus(electionId, guardian.getGuardianId());
                return com.amarvote.amarvote.dto.GuardianDecryptionProgressItem.builder()
                    .guardianId(guardian.getGuardianId())
                    .guardianName(guardian.getUserEmail())
                    .guardianEmail(guardian.getUserEmail())
                    .profilePic(null)
                    .sequenceOrder(guardian.getSequenceOrder())
                    .decryptedOrNot(guardian.getDecryptedOrNot())
                    .status(status.getStatus())
                    .currentPhase(status.getCurrentPhase())
                    .totalChunks(status.getTotalChunks())
                    .processedChunks(status.getProcessedChunks())
                    .progressPercentage(status.getProgressPercentage())
                    .build();
            })
            .collect(Collectors.toList());
    }

    /**
     * Get current decryption status for a guardian
     * Queries RoundRobinTaskScheduler for real-time chunk processing state
     */
    public DecryptionStatusResponse getDecryptionStatus(Long electionId, Long guardianId) {
        // Query ElectionJob for task metadata
        Optional<com.amarvote.amarvote.model.ElectionJob> jobOpt = jobRepository.findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(electionId, "DECRYPTION_" + guardianId);
        java.time.Instant startedAtJob = jobOpt.map(com.amarvote.amarvote.model.ElectionJob::getStartedAt).orElse(null);
        
        // Get guardian details
        Optional<Guardian> guardianOpt = guardianRepository.findById(guardianId);
        if (guardianOpt.isEmpty()) {
            return DecryptionStatusResponse.builder()
                .success(false)
                .status("not_found")
                .message("Guardian not found")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .build();
        }
        
        Guardian guardian = guardianOpt.get();
        
        // Check for active Redis lock
        String lockKey = RedisLockService.buildDecryptionLockKey(electionId, String.valueOf(guardianId));
        Optional<LockMetadata> lockMetadata = redisLockService.getLockMetadata(lockKey);
        
        // Try to get progress from scheduler first (live task tracking)
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> electionProgress = 
            decryptionTaskQueueService.getRoundRobinTaskScheduler().getElectionProgress(electionId);
        
        // Filter for tasks related to this specific guardian
        // CRITICAL FIX: Filter by guardianId to show only THIS guardian's progress
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> guardianTasks = electionProgress.stream()
            .filter(p -> {
                // For partial decryption: check guardianId matches
                if (p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.PARTIAL_DECRYPTION) {
                    return guardianId.equals(p.getGuardianId());
                }
                // For compensated decryption: check sourceGuardianId matches (the guardian doing the compensation)
                if (p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.COMPENSATED_DECRYPTION) {
                    return guardianId.equals(p.getSourceGuardianId());
                }
                return false;
            })
            .collect(Collectors.toList());
        
        if (!guardianTasks.isEmpty()) {
            // Active task found in scheduler - return live progress
            // Separate partial and compensated tasks
            var partialTasks = guardianTasks.stream()
                .filter(p -> p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.PARTIAL_DECRYPTION)
                .findFirst();
            var compensatedTasks = guardianTasks.stream()
                .filter(p -> p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.COMPENSATED_DECRYPTION)
                .collect(Collectors.toList());
            
            // Get all guardians to calculate compensated decryptions needed
            // FIX: Don't use compensatedTasks.size() because during partial decryption phase, 
            // compensated tasks haven't been scheduled yet, so it would be 0
            List<Guardian> allGuardians = guardianRepository.findByElectionId(electionId);
            long totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);

            List<Long> tallyCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(electionId);
            long totalChunks = !tallyCenterIds.isEmpty()
                ? tallyCenterIds.size()
                : (partialTasks.isPresent() ? partialTasks.get().getTotalChunks() : 0);
            long completedChunks = decryptionRepository.countByElectionIdAndGuardianId(electionId, guardianId);
            long compensatedDecryptionCount = compensatedDecryptionRepository
                .countByElectionIdAndCompensatingGuardianId(electionId, guardianId);
            long compensatedCompletedChunks = compensatedDecryptionCount;
            long expectedCompensatedCount = totalChunks * totalCompensatedGuardians;
            boolean stopRequested = cancellationService.isGuardianDecryptionStopped(electionId, guardianId);
            boolean schedulerStopped = guardianTasks.stream()
                .anyMatch(com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress::isStopped);

            String currentPhase = null;
            if (totalChunks == 0) {
                currentPhase = null;
            } else if (completedChunks < totalChunks) {
                currentPhase = "partial_decryption";
            } else if (totalCompensatedGuardians > 0 && compensatedDecryptionCount < expectedCompensatedCount) {
                currentPhase = "compensated_shares_generation";
            } else {
                currentPhase = "completed";
            }

            long totalExpected = totalChunks * (1 + totalCompensatedGuardians);
            long totalProcessed = completedChunks + compensatedCompletedChunks;

            String status;
            if ("completed".equals(currentPhase)) {
                status = "completed";
            } else if (stopRequested || schedulerStopped) {
                status = "stopped";
            } else if (totalProcessed == 0) {
                status = "pending";
            } else {
                status = "in_progress";
            }
            
            double progressPercentage = totalExpected > 0 
                ? (totalProcessed * 100.0) / totalExpected
                : 0.0;
            
            double compensatedProgressPercentage = totalCompensatedGuardians > 0 && totalChunks > 0
                ? (compensatedCompletedChunks * 100.0) / (totalChunks * totalCompensatedGuardians)
                : 0.0;
            
            // Determine what values to return based on current phase
            int returnTotalChunks;
            int returnProcessedChunks;
            
            if (currentPhase != null && currentPhase.equals("compensated_shares_generation")) {
                // During compensated phase: totalChunks = n × (m-1), processedChunks = compensated completed
                returnTotalChunks = (int) (totalChunks * totalCompensatedGuardians);
                returnProcessedChunks = (int) compensatedCompletedChunks;
            } else if (currentPhase != null && currentPhase.equals("completed")) {
                // FIXED: When completed, return actual chunk count (n) not compensated calculation
                // Frontend expects totalChunks = n so it can calculate total operations = n × m
                returnTotalChunks = (int) totalChunks; // This is the actual number of chunks
                returnProcessedChunks = (int) completedChunks; // Partial decryption count
            } else {
                // During partial decryption phase: totalChunks = n, processedChunks = partial completed
                returnTotalChunks = (int) totalChunks;
                returnProcessedChunks = (int) completedChunks;
            }
            
            return DecryptionStatusResponse.builder()
                .success(true)
                .status(status)
                .message("Decryption status retrieved successfully")
                .totalChunks(returnTotalChunks)
                .processedChunks(returnProcessedChunks)
                .progressPercentage(progressPercentage)
                .currentPhase(currentPhase)
                .totalCompensatedGuardians((int) totalCompensatedGuardians)
                .processedCompensatedGuardians((int) (compensatedCompletedChunks / Math.max(1, totalChunks)))
                .compensatedProgressPercentage(compensatedProgressPercentage)
                .guardianEmail(guardian.getUserEmail())
                .guardianName(guardian.getUserEmail())
                .startedAt(startedAtJob != null ? startedAtJob.toString() : null)
                .isLocked(lockMetadata.isPresent())
                .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
                .lockStartTime(lockMetadata.map(m -> m.getStartTime().toString()).orElse(null))
                .build();
        }
        
        // No active task in scheduler - check database for completed decryption
        List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(electionId);
        int totalChunks = electionCenterIds.size();
        
        if (totalChunks == 0) {
            return DecryptionStatusResponse.builder()
                .success(true)
                .status("not_started")
                .message("No tally chunks found for this election")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .guardianEmail(guardian.getUserEmail())
                .guardianName(guardian.getUserEmail())
                .isLocked(lockMetadata.isPresent())
                .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
                .lockStartTime(lockMetadata.map(m -> m.getStartTime().toString()).orElse(null))
                .build();
        }
        
        // Count partial decryptions (filled rows in decryptions table)
        long partialDecryptionCount = decryptionRepository.countByElectionIdAndGuardianId(electionId, guardianId);
        
        // Get all guardians to calculate compensated decryptions needed
        List<Guardian> allGuardians = guardianRepository.findByElectionId(electionId);
        int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1); // All except self
        
        // Count compensated decryptions (filled rows in compensated_decryptions table)
        long compensatedDecryptionCount = 0;
        if (totalCompensatedGuardians > 0) {
            compensatedDecryptionCount = compensatedDecryptionRepository
                .countByElectionIdAndCompensatingGuardianId(electionId, guardianId);
        }
        
        // Calculate total expected decryptions per chunk
        long expectedPerChunk = 1 + totalCompensatedGuardians;
        long totalExpected = totalChunks * expectedPerChunk;
        long totalProcessed = partialDecryptionCount + compensatedDecryptionCount;
        
        // Determine status
        String status;
        String currentPhase = null;
        
        if (totalProcessed == 0) {
            status = "not_started";
            currentPhase = null;
        } else if (totalProcessed >= totalExpected) {
            status = "completed";
            currentPhase = "completed";
        } else if (cancellationService.isGuardianDecryptionStopped(electionId, guardianId)) {
            status = "stopped";
        } else if (partialDecryptionCount < totalChunks) {
            status = "in_progress";
            currentPhase = "partial_decryption";
        } else if (totalCompensatedGuardians > 0 && compensatedDecryptionCount < (totalChunks * totalCompensatedGuardians)) {
            status = "in_progress";
            currentPhase = "compensated_shares_generation";
        } else if (totalProcessed >= totalExpected) {
            status = "completed";
            currentPhase = "completed";
        } else {
            status = "in_progress";
        }
        
        double progressPercentage = totalExpected > 0 
            ? (totalProcessed * 100.0) / totalExpected
            : 0.0;
        
        double compensatedProgressPercentage = totalCompensatedGuardians > 0
            ? (compensatedDecryptionCount * 100.0) / (totalChunks * totalCompensatedGuardians)
            : 0.0;
        
        // Determine what values to return based on current phase
        int returnTotalChunks;
        int returnProcessedChunks;
        
        if (currentPhase != null && currentPhase.equals("compensated_shares_generation")) {
            // During compensated phase: totalChunks = n × (m-1), processedChunks = compensated completed
            returnTotalChunks = totalChunks * totalCompensatedGuardians;
            returnProcessedChunks = (int) compensatedDecryptionCount;
        } else if (currentPhase != null && currentPhase.equals("completed")) {
            // FIXED: When completed, return actual chunk count (n) not compensated calculation
            // Frontend expects totalChunks = n so it can calculate total operations = n × m
            returnTotalChunks = totalChunks; // This is the actual number of chunks
            returnProcessedChunks = (int) partialDecryptionCount; // Partial decryption count
        } else {
            // During partial decryption phase: totalChunks = n, processedChunks = partial completed
            returnTotalChunks = totalChunks;
            returnProcessedChunks = (int) partialDecryptionCount;
        }
        
        return DecryptionStatusResponse.builder()
            .success(true)
            .status(status)
            .message("Decryption status retrieved successfully")
            .totalChunks(returnTotalChunks)
            .processedChunks(returnProcessedChunks)
            .progressPercentage(progressPercentage)
            .currentPhase(currentPhase)
            .totalCompensatedGuardians(totalCompensatedGuardians)
            .processedCompensatedGuardians((int) (compensatedDecryptionCount / Math.max(1, totalChunks)))
            .compensatedProgressPercentage(compensatedProgressPercentage)
            .guardianEmail(guardian.getUserEmail())
            .guardianName(guardian.getUserEmail())
            .isLocked(lockMetadata.isPresent())
            .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
            .lockStartTime(lockMetadata.map(m -> m.getStartTime().toString()).orElse(null))
            .build();
    }

    /**
     * Process decryption asynchronously with detailed progress tracking (MEMORY-EFFICIENT)
     * NOTE: @Transactional removed from async method to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processChunkTransactional().
    */
    public void processDecryptionAsync(CreatePartialDecryptionRequest request, String userEmail, 
                                       Guardian guardian) {
        String lockKey = RedisLockService.buildDecryptionLockKey(
            request.election_id(), 
            String.valueOf(guardian.getGuardianId())
        );
        
        try {
            
            // Create ElectionJob record for tracking
            com.amarvote.amarvote.model.ElectionJob job = com.amarvote.amarvote.model.ElectionJob.builder()
                .jobId(java.util.UUID.randomUUID())
                .electionId(request.election_id())
                .operationType("DECRYPTION_" + guardian.getGuardianId())
                .status("IN_PROGRESS")
                .totalChunks(0) // Will be updated below
                .processedChunks(0)
                .createdBy(userEmail)
                .startedAt(java.time.Instant.now())
                .build();
            jobRepository.save(job);
            
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(request.election_id());
            long existingPartialCount = decryptionRepository.countByElectionIdAndGuardianId(
                request.election_id(), guardian.getGuardianId());
            List<Long> pendingCenterIds = electionCenterIds.stream()
                .filter(centerId -> decryptionRepository.findByElectionCenterIdAndGuardianId(centerId, guardian.getGuardianId()).isEmpty())
                .collect(Collectors.toList());
            
            // Get all guardians to calculate total compensated guardians upfront
            List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
            // All other guardians except self (0 if single guardian)
            int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);
            
            if (totalCompensatedGuardians == 0) {
            } else {
            }
            
            Runtime runtime = Runtime.getRuntime();
            long maxMemoryMB = runtime.maxMemory() / (1024 * 1024);
            
            // Get election choices (for future use if needed)
            electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.election_id());
            
            // Decrypt guardian credentials
            String guardianCredentials = guardian.getCredentials();
            if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
                throw new RuntimeException("Guardian credentials not found");
            }
            
            ElectionGuardCryptoService.GuardianDecryptionResult decryptionResult = 
                cryptoService.decryptGuardianData(request.encrypted_data(), guardianCredentials);
            String decryptedPrivateKey = decryptionResult.getPrivateKey();
            String decryptedPolynomial = decryptionResult.getPolynomial();
            
            
            // ✅ SECURE: Store credentials in Redis (in-memory, auto-expiring) instead of database
            // Industry best practice for temporary sensitive data - no database breach exposure
            credentialCacheService.storePrivateKey(request.election_id(), guardian.getGuardianId(), decryptedPrivateKey);
            credentialCacheService.storePolynomial(request.election_id(), guardian.getGuardianId(), decryptedPolynomial);
            
            if (pendingCenterIds.isEmpty() && existingPartialCount >= electionCenterIds.size()) {
            } else {

                decryptionTaskQueueService.queuePartialDecryptionTasks(
                    request.election_id(),
                    guardian.getGuardianId(),
                    pendingCenterIds,
                    decryptedPrivateKey,
                    decryptedPolynomial
                );

            }
            
            /* OLD CODE - Replaced with RabbitMQ queue-based processing
            // PHASE 1: Process each chunk for partial decryption (MEMORY-EFFICIENT)
            int processedChunks = 0;
            
            for (Long electionCenterId : electionCenterIds) {
                processedChunks++;
                
                long chunkStartTime = System.currentTimeMillis();
                
                // ... [loop processing code removed]
            }
            
            
            // 🔒 DO NOT mark guardian as decrypted yet - wait until Phase 2 completes
            // guardian.setDecryptedOrNot(true); // MOVED TO AFTER PHASE 2
            
            // PHASE 2: Create compensated decryption shares for other guardians
            createCompensatedDecryptionSharesWithProgress(election, guardian, decryptedPrivateKey, 
                decryptedPolynomial, electionCenterIds);
            
            // ✅ NOW mark guardian as fully decrypted (both phases complete)
            markGuardianDecrypted(guardian);
            
            // Mark as completed
            updateDecryptionStatus(request.election_id(), guardian.getGuardianId(), "completed",
                "completed", processedChunks, electionCenterIds.size(), null, null, Instant.now());
            */
            
            
        } catch (Exception e) {
            System.err.println("❌ Error in async decryption: " + e.getClass().getName() + ": " + e.getMessage());
            System.err.println("Stack trace: " + e);
            
            // Provide user-friendly error message
            String userFriendlyError;
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            
            if (errorMsg.contains("Invalid credentials")) {
                userFriendlyError = "The credential file you provided was incorrect. Please submit the correct credentials.txt file that was sent to you via email.";
            } else if (errorMsg.contains("credentials not found") || errorMsg.contains("Credentials not found")) {
                userFriendlyError = "Your credentials could not be found in the system. Please contact the election administrator.";
            } else if (errorMsg.contains("Failed to generate decryption")) {
                userFriendlyError = "Decryption processing failed. Please try again or contact the election administrator if the problem persists.";
            } else if (errorMsg.contains("Election center not found")) {
                userFriendlyError = "Election data chunk not found. The tally may have been corrupted. Please contact the election administrator.";
            } else if (errorMsg.contains("no encrypted tally") || errorMsg.contains("has no encrypted tally")) {
                userFriendlyError = "One or more election data chunks are missing encrypted tally data. Please ensure the tally was created successfully before decryption.";
            } else if (e instanceof NullPointerException) {
                userFriendlyError = "A critical data element was not found. This may indicate incomplete election setup. Please contact the election administrator. (Error type: " + e.getClass().getSimpleName() + ")";
            } else {
                userFriendlyError = "An unexpected error occurred during decryption: " + errorMsg + ". Please try again or contact the election administrator.";
            }
            
            System.err.println("❌ Decryption failed: " + userFriendlyError);
        } finally {
            // Release Redis lock
            redisLockService.releaseLock(lockKey);
        }
    }

    /**
     * Process single partial decryption chunk in isolated transaction
     * This method is called from createPartialDecryption for each chunk
     */
    @Transactional
    private void processPartialDecryptionChunkTransactional(
            Long electionCenterId,
            int chunkNumber,
            Guardian guardian,
            String decryptedPrivateKey,
            String decryptedPolynomial,
            List<String> candidateNames,
            List<String> partyNames,
            int numberOfGuardians,
            String jointPublicKey,
            String baseHash,
            int quorum) {
        
        
        // Log memory before processing
        Runtime runtime = Runtime.getRuntime();
        long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        
        // Fetch election center for this chunk
        ElectionCenter electionCenter = electionCenterRepository.findById(electionCenterId)
            .orElseThrow(() -> new RuntimeException("ElectionCenter not found: " + electionCenterId));
        
        // Get encrypted tally for this chunk
        String ciphertextTallyString = electionCenter.getEncryptedTally();
        if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
            throw new RuntimeException("Chunk " + chunkNumber + " has no encrypted tally");
        }
        
        // ✅ MEMORY-EFFICIENT: Load only cipherText strings (not full SubmittedBallot entities)
        // This reduces memory usage by 70-90% compared to loading full entities
        List<String> ballotCipherTexts = submittedBallotRepository.findCipherTextsByElectionCenterId(electionCenterId);
        
        // Use the full guardian data (key_backup) - the microservice needs the complete
        // ElectionGuard guardian state including backups for partial decryption.
        // Fall back to minimal JSON only if key_backup is not yet populated.
        String guardianDataJson;
        if (guardian.getKeyBackup() != null && !guardian.getKeyBackup().trim().isEmpty()) {
            guardianDataJson = guardian.getKeyBackup();
        } else {
            guardianDataJson = String.format(
                "{\"id\":\"%s\",\"sequence_order\":%d}",
                guardian.getSequenceOrder(),
                guardian.getSequenceOrder()
            );
        }
        
        // Call ElectionGuard microservice for this chunk — all complex fields must be parsed
        // from JSON strings to native Java objects so msgpack encodes them as maps/dicts
        ElectionGuardPartialDecryptionRequest guardRequest = ElectionGuardPartialDecryptionRequest.builder()
            .guardian_id(String.valueOf(guardian.getSequenceOrder()))
            .guardian_data(parseJsonToObject(guardianDataJson))
            .private_key(parseJsonToObject(decryptedPrivateKey))
            .public_key(parseJsonToObject(guardian.getGuardianPublicKey()))
            .polynomial(parseJsonToObject(decryptedPolynomial))
            .party_names(partyNames)
            .candidate_names(candidateNames)
            .ciphertext_tally(parseJsonToObject(ciphertextTallyString))
            .submitted_ballots(parseJsonStringList(ballotCipherTexts))
            .joint_public_key(jointPublicKey)
            .commitment_hash(baseHash)
            .number_of_guardians(numberOfGuardians)
            .quorum(quorum)
            .build();
        
        ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);
        
        // Check if tally_share is null (invalid key)
        if (guardResponse.tally_share() == null) {
            throw new RuntimeException("Invalid credentials provided");
        }
        
        // Store decryption data for this chunk in the Decryption table
        Decryption decryption = Decryption.builder()
            .electionCenterId(electionCenterId)
            .guardianId(guardian.getGuardianId())
            .tallyShare(toJsonString(guardResponse.tally_share()))
            .guardianDecryptionKey(guardResponse.guardian_public_key())
            .partialDecryptedTally(toJsonString(guardResponse.ballot_shares()))
            .build();
        
        decryptionRepository.save(decryption);
        
        // ✅ CRITICAL: Aggressive Hibernate memory cleanup
        entityManager.flush();   // Write pending changes to DB
        entityManager.clear();   // Clear persistence context - releases all entities
        
        // ✅ Clear large collections; local variables go out of scope at method end
        ballotCipherTexts.clear();
        
        // Log memory after cleanup
        long memoryAfterMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long freedMemoryMB = memoryBeforeMB - memoryAfterMB;
    }

    // Removed: saveCompensatedDecryptionTransactional - inlined at call site

    /**
     * Create compensated decryption shares with progress tracking (MEMORY-EFFICIENT)
     */

    private ElectionGuardPartialDecryptionResponse callElectionGuardPartialDecryptionService(
            ElectionGuardPartialDecryptionRequest request) {
        
        long startTime = System.currentTimeMillis();
        String threadName = Thread.currentThread().getName();
        
        
        try {
            String url = "/create_partial_decryption";
            
            
            String response = electionGuardService.postRequest(url, request);
            
            long duration = System.currentTimeMillis() - startTime;
            
            if (response == null) {
                System.err.println("❌ [BACKEND] ERROR: Received null response from ElectionGuard");
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            ElectionGuardPartialDecryptionResponse parsedResponse = objectMapper.readValue(response, ElectionGuardPartialDecryptionResponse.class);
            
            return parsedResponse;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            System.err.println("=====================================================================");
            System.err.println("❌ [BACKEND] FAILED TO CALL ELECTIONGUARD SERVICE");
            System.err.println("=====================================================================");
            System.err.println("⏱️ Time elapsed: " + duration + "ms");
            System.err.println("⚠️ Error type: " + e.getClass().getName());
            System.err.println("⚠️ Error message: " + e.getMessage());
            System.err.println("=====================================================================");
            // Stack trace available in exception: e
            throw new RuntimeException("Failed to call ElectionGuard partial decryption service", e);
        }
    }

    /**
     * Initiate async combine partial decryption process
     */
    public CombinePartialDecryptionResponse initiateCombine(Long electionId, String userEmail) {
        try {
            Election election = electionRepository.findById(electionId).orElse(null);
            if (election == null) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            if (!electionService.isElectionAdmin(election, userEmail)) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Only the election admin or co-admins can combine decryptions")
                    .build();
            }

            // 1. Check if election centers exist
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            if (electionCenters == null || electionCenters.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("No election centers found. Please create tally first.")
                    .build();
            }
            
            // 2. Try to acquire Redis lock FIRST
            String lockKey = RedisLockService.buildCombineLockKey(electionId);
            String initiatorEmail = (userEmail != null && !userEmail.isBlank()) ? userEmail : "system";
            boolean lockAcquired = redisLockService.tryAcquireLock(
                lockKey,
                initiatorEmail,
                "COMBINE_DECRYPTION",
                "Election ID: " + electionId
            );
            
            if (!lockAcquired) {
                // Lock already exists - get metadata to inform user
                Optional<LockMetadata> existingLock = redisLockService.getLockMetadata(lockKey);
                if (existingLock.isPresent()) {
                    LockMetadata metadata = existingLock.get();
                    return CombinePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Combine is already in progress. Started by " + metadata.getUserEmail() + " at " + metadata.getStartTime())
                        .build();
                } else {
                    return CombinePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Combine is already in progress")
                        .build();
                }
            }
            
            try {
                // 3. Lock acquired - now check database to see if work already exists

                // 3a. Check for an active ElectionJob (IN_PROGRESS or QUEUED).
                // If one exists AND the scheduler has live COMBINE_DECRYPTION tasks → genuinely in-flight, reject.
                // If one exists but no live tasks → stale record, clean it up and proceed.
                if (jobRepository.existsActiveJob(electionId, "COMBINE")) {
                    boolean hasLiveCombineTasks = hasActiveCombineSchedulerTasks(electionId);

                    if (hasLiveCombineTasks) {
                        redisLockService.releaseLock(lockKey);
                        return CombinePartialDecryptionResponse.builder()
                            .success(true)
                            .message("Combine is already in progress")
                            .build();
                    }

                    // Stale: mark old jobs FAILED so they don't block future requests
                    jobRepository.findByElectionIdOrderByStartedAtDesc(electionId)
                        .stream()
                        .filter(j -> ("IN_PROGRESS".equals(j.getStatus()) || "QUEUED".equals(j.getStatus()))
                            && "COMBINE".equals(j.getOperationType()))
                        .forEach(j -> {
                            j.setStatus("FAILED");
                            j.setErrorMessage("Marked FAILED: process exited without completing (no active scheduler tasks on re-check)");
                            j.setCompletedAt(java.time.Instant.now());
                            jobRepository.save(j);
                        });
                }

                // 3b. Check existing combine records in database
                long completedChunks = electionCenterRepository.countByElectionIdAndElectionResultNotNull(electionId);
                
                if (completedChunks > 0 && completedChunks < electionCenters.size()) {
                    // Release lock since work already in progress
                    redisLockService.releaseLock(lockKey);
                    return CombinePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Combine is already in progress")
                        .build();
                }
                
                if (completedChunks == electionCenters.size()) {
                    // Release lock since work already completed
                    redisLockService.releaseLock(lockKey);
                    return CombinePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Combine already completed for this election")
                        .build();
                }
                
                
                // 4. Start async processing (lock will be held during processing)
                asyncTaskDispatcher.run(() -> processCombineAsync(electionId, initiatorEmail));
                
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Combine process initiated. Processing in progress...")
                    .build();
                    
            } catch (Exception e) {
                // Release lock on error
                redisLockService.releaseLock(lockKey);
                throw e;
            }
            
        } catch (Exception e) {
            System.err.println("Error initiating combine: " + e.getMessage());
            // Stack trace available in exception: e
            return CombinePartialDecryptionResponse.builder()
                .success(false)
                .message("Failed to initiate combine: " + e.getMessage())
                .build();
        }
    }

    /**
     * Process combine asynchronously with progress updates
     * NEW: Uses RabbitMQ queue to process chunks individually
     */
    public void processCombineAsync(Long electionId, String userEmail) {
        String lockKey = RedisLockService.buildCombineLockKey(electionId);
        
        try {
            
            // Create ElectionJob record for tracking
            com.amarvote.amarvote.model.ElectionJob job = com.amarvote.amarvote.model.ElectionJob.builder()
                .jobId(java.util.UUID.randomUUID())
                .electionId(electionId)
                .operationType("COMBINE")
                .status("IN_PROGRESS")
                .totalChunks(0) // Will be updated below
                .processedChunks(0)
                .createdBy(userEmail != null && !userEmail.isBlank() ? userEmail : "system")
                .startedAt(java.time.Instant.now())
                .build();
            jobRepository.save(job);
            
            // Get election center IDs that have a completed tally (not full objects - memory efficient)
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(electionId);
            int totalChunks = electionCenterIds != null ? electionCenterIds.size() : 0;
            
            if (totalChunks == 0) {
                System.err.println("❌ No election centers found");
                return;
            }
            
            // ✅ NEW: Queue combine tasks instead of processing in loop
            decryptionTaskQueueService.queueCombineDecryptionTasks(electionId, electionCenterIds);
            
            
            /* OLD CODE - Replaced with RabbitMQ queue-based processing
            // Call the existing combine method
            CombinePartialDecryptionRequest request = new CombinePartialDecryptionRequest(electionId);
            CombinePartialDecryptionResponse response = combinePartialDecryption(request);
            
            if (response.success()) {
                // Mark as completed with correct processed chunks count
            } else {
                System.err.println("❌ COMBINE PROCESS FAILED: " + response.message());
            }
            */
            
        } catch (Exception e) {
            System.err.println("❌ Error in async combine: " + e.getMessage());
            System.err.println("Stack trace: " + e);
        } finally {
            // Release Redis lock
            redisLockService.releaseLock(lockKey);
        }
    }

    // Removed: updateCombineStatus - no longer needed as we query database directly

    /**
     * Get current combine status for an election
     * Queries RoundRobinTaskScheduler for real-time chunk processing state
     */
    public CombineStatusResponse getCombineStatus(Long electionId) {
        // Query ElectionJob for task metadata
        Optional<com.amarvote.amarvote.model.ElectionJob> jobOpt = jobRepository.findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(electionId, "COMBINE");
        String createdBy = jobOpt.map(com.amarvote.amarvote.model.ElectionJob::getCreatedBy).orElse(null);
        java.time.Instant startedAtJob = jobOpt.map(com.amarvote.amarvote.model.ElectionJob::getStartedAt).orElse(null);
        
        // Check for active Redis lock
        String lockKey = RedisLockService.buildCombineLockKey(electionId);
        Optional<LockMetadata> lockMetadata = redisLockService.getLockMetadata(lockKey);
        
        // Try to get progress from scheduler first (live task tracking)
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> electionProgress = 
            decryptionTaskQueueService.getRoundRobinTaskScheduler().getElectionProgress(electionId);
        
        // Filter for combine decryption tasks
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> combineTasks = electionProgress.stream()
            .filter(p -> p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.COMBINE_DECRYPTION)
            .collect(Collectors.toList());
        
        if (!combineTasks.isEmpty()) {
            com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress progress = combineTasks.get(0);
            List<Long> tallyCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(electionId);
            int totalChunks = !tallyCenterIds.isEmpty() ? tallyCenterIds.size() : (int) progress.getTotalChunks();
            int processedChunks = (int) electionCenterRepository.countByElectionIdAndElectionResultNotNull(electionId);
            boolean stopRequested = cancellationService.isCombineStopped(electionId);

            String status;
            if (processedChunks >= totalChunks && totalChunks > 0) {
                status = "completed";
            } else if (stopRequested || progress.isStopped()) {
                status = "stopped";
            } else if (progress.isActive() || processedChunks > 0) {
                status = "in_progress";
            } else {
                status = "pending";
            }

            double progressPercentage = totalChunks > 0
                ? (processedChunks * 100.0) / totalChunks
                : 0.0;

            return CombineStatusResponse.builder()
                .success(true)
                .status(status)
                .message("Combine status retrieved successfully")
                .totalChunks(totalChunks)
                .processedChunks(processedChunks)
                .progressPercentage(progressPercentage)
                .createdBy(createdBy)
                .startedAt(startedAtJob)
                .isLocked(lockMetadata.isPresent())
                .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
                .lockStartTime(lockMetadata.map(LockMetadata::getStartTime).orElse(null))
                .build();
        }

        List<Long> tallyCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(electionId);
        int totalChunks = tallyCenterIds.size();
        
        if (totalChunks == 0) {
            return CombineStatusResponse.builder()
                .success(true)
                .status("not_started")
                .message("No tally chunks found for this election")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .isLocked(lockMetadata.isPresent())
                .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
                .lockStartTime(lockMetadata.map(LockMetadata::getStartTime).orElse(null))
                .build();
        }
        
        // Count how many chunks have electionResult filled (combination completed)
        long processedChunks = electionCenterRepository.countByElectionIdAndElectionResultNotNull(electionId);
        
        // Determine status based on progress
        String status;
        if (processedChunks == 0) {
            status = "not_started";
        } else if (processedChunks >= totalChunks && totalChunks > 0) {
            status = "completed";
        } else if (cancellationService.isCombineStopped(electionId)) {
            status = "stopped";
        } else if (processedChunks < totalChunks) {
            status = "in_progress";
        } else {
            status = "completed";
        }
        
        double progressPercentage = totalChunks > 0 
            ? (processedChunks * 100.0) / totalChunks
            : 0.0;
        
        return CombineStatusResponse.builder()
            .success(true)
            .status(status)
            .message("Combine status retrieved successfully")
            .totalChunks(totalChunks)
            .processedChunks((int) processedChunks)
            .progressPercentage(progressPercentage)
            .isLocked(lockMetadata.isPresent())
            .lockHeldBy(lockMetadata.map(LockMetadata::getUserEmail).orElse(null))
            .lockStartTime(lockMetadata.map(LockMetadata::getStartTime).orElse(null))
            .build();
    }

    /**
     * NOTE: @Transactional removed to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processCombineChunkTransactional().
     */
    public CombinePartialDecryptionResponse combinePartialDecryption(CombinePartialDecryptionRequest request) {
        try {
            
            // 1. Fetch election
            Optional<Election> electionOpt = electionRepository.findById(request.election_id());
            if (!electionOpt.isPresent()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            Election election = electionOpt.get();

            // 2. MEMORY-EFFICIENT: Check if tally exists using IDs first (only centres with a completed tally)
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsWithTallyByElectionId(request.election_id());
            if (electionCenterIds == null || electionCenterIds.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election tally has not been created yet. Please create the tally first.")
                    .build();
            }
            

            // 2.5. Check if results already exist (optimization) - need to fetch one center to check
            boolean allChunksHaveResults = true;
            for (Long ecId : electionCenterIds) {
                Optional<ElectionCenter> ecOpt = electionCenterRepository.findById(ecId);
                if (!ecOpt.isPresent() || ecOpt.get().getElectionResult() == null || ecOpt.get().getElectionResult().trim().isEmpty()) {
                    allChunksHaveResults = false;
                    break;
                }
            }
            
            if (allChunksHaveResults) {
                
                // Fetch all centers to build aggregated results
                List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
                Object cachedResults = buildAggregatedResultsFromChunks(electionCenters);
                
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Election results retrieved from cache")
                    .results(cachedResults)
                    .build();
            }
            

            // 3. Fetch election choices for candidate_names and party_names
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.election_id());
            // electionChoices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            
            if (electionChoices.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("No election choices found for this election")
                    .build();
            }
            
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .filter(partyName -> partyName != null && !partyName.trim().isEmpty())
                .distinct()
                .collect(Collectors.toList());

            // 5. Fetch all guardians for this election
            List<Guardian> guardians = guardianRepository.findByElectionId(request.election_id());
            if (guardians.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("No guardians found for this election")
                    .build();
            }

            // 6. ✅ Check quorum before combining decryption shares
            List<Guardian> availableGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() != null && g.getDecryptedOrNot())
                .collect(Collectors.toList());
            
            int quorum = election.getElectionQuorum();
            if (availableGuardians.size() < quorum) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message(String.format("Quorum not met for decryption. Need at least %d guardians to decrypt election results, but only %d guardians have submitted their keys. Please ensure more guardians submit their partial decryption keys.", 
                            quorum, availableGuardians.size()))
                    .build();
            }


            // Log available and missing guardian details
            List<Integer> availableSequences = availableGuardians.stream()
                .map(Guardian::getSequenceOrder)
                .collect(Collectors.toList());

            // 7. ✅ PROCESS EACH CHUNK SEPARATELY (MEMORY-EFFICIENT)
            // Loop through each election_center ID and combine decryption shares for that chunk
            int processedChunkCount = 0;
            for (Long electionCenterId : electionCenterIds) {
                processedChunkCount++;
                
                // MEMORY-EFFICIENT: Fetch only the election center needed for this iteration
                Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
                if (!electionCenterOpt.isPresent()) {
                    System.err.println("❌ Election center not found: " + electionCenterId);
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Election center not found: " + electionCenterId)
                        .build();
                }
                ElectionCenter electionCenter = electionCenterOpt.get();
                
                // Removed: updateCombineStatus call - status is now queried directly from database
                
                // Get submitted ballots for THIS CHUNK ONLY
                List<SubmittedBallot> chunkSubmittedBallots = submittedBallotRepository.findByElectionCenterId(electionCenter.getElectionCenterId());

                
                List<String> ballotCipherTexts = chunkSubmittedBallots.stream()
                    .map(SubmittedBallot::getCipherText)
                    .collect(Collectors.toList());
                
                // Get decryptions for THIS CHUNK
                List<Decryption> decryptions = decryptionRepository.findByElectionCenterId(electionCenter.getElectionCenterId());
            
                
                // Create a map for faster guardian decryption lookup
                Map<Long, Decryption> guardianDecryptionMap = decryptions.stream()
                    .collect(Collectors.toMap(Decryption::getGuardianId, d -> d, (d1, d2) -> d1));
                
                // Get guardian data for all guardians from guardians.key_backup field (needed for missing guardian reconstruction)
                List<String> guardianDataList = new ArrayList<>();
                for (Guardian guardian : guardians) {
                    if (guardian.getKeyBackup() != null && !guardian.getKeyBackup().trim().isEmpty()) {
                        guardianDataList.add(guardian.getKeyBackup());
                    } else {
                        // Fallback: construct guardian_data if key_backup is not available
                        String guardianDataJson = String.format(
                            "{\"id\":\"%s\",\"sequence_order\":%d}",
                            guardian.getSequenceOrder(),
                            guardian.getSequenceOrder()
                        );
                        guardianDataList.add(guardianDataJson);
                    }
                }

                // Available guardian data (those who completed decryption)
                List<String> availableGuardianIds = availableGuardians.stream()
                    .map(g -> String.valueOf(g.getSequenceOrder()))
                    .collect(Collectors.toList());
                
                // Get guardian decryption keys from Decryptions table
                List<String> availableGuardianPublicKeys = new ArrayList<>();
                for (Guardian guardian : availableGuardians) {
                    Decryption decryption = guardianDecryptionMap.get(guardian.getGuardianId());
                    if (decryption != null && decryption.getGuardianDecryptionKey() != null && 
                        !decryption.getGuardianDecryptionKey().trim().isEmpty()) {
                        availableGuardianPublicKeys.add(decryption.getGuardianDecryptionKey());
                    } else {
                        System.err.println("WARNING: Missing guardian decryption key for guardian " + guardian.getSequenceOrder());
                        return CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Missing guardian decryption key data. Please ensure all guardians have submitted their keys.")
                            .build();
                    }
                }
                
                // Get tally shares from Decryptions table
                List<String> availableTallyShares = new ArrayList<>();
                for (Guardian guardian : availableGuardians) {
                    Decryption decryption = guardianDecryptionMap.get(guardian.getGuardianId());
                    if (decryption != null && decryption.getTallyShare() != null && 
                        !decryption.getTallyShare().trim().isEmpty()) {
                        availableTallyShares.add(decryption.getTallyShare());
                    } else {
                        System.err.println("WARNING: Missing tally share for guardian " + guardian.getSequenceOrder());
                        return CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Missing tally share data. Please ensure all guardians have submitted their keys.")
                            .build();
                    }
                }
                
                // Get partial decrypted tally (ballot shares) from Decryptions table
                List<String> availableBallotShares = new ArrayList<>();
                for (Guardian guardian : availableGuardians) {
                    Decryption decryption = guardianDecryptionMap.get(guardian.getGuardianId());
                    if (decryption != null && decryption.getPartialDecryptedTally() != null && 
                        !decryption.getPartialDecryptedTally().trim().isEmpty()) {
                        availableBallotShares.add(decryption.getPartialDecryptedTally());
                    } else {
                        System.err.println("WARNING: Missing ballot shares for guardian " + guardian.getSequenceOrder());
                        return CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Missing ballot shares data. Please ensure all guardians have submitted their keys.")
                            .build();
                    }
                }

                // Missing guardian data (those who haven't completed decryption)
                List<Guardian> missingGuardians = guardians.stream()
                    .filter(g -> g.getDecryptedOrNot() == null || !g.getDecryptedOrNot())
                    .collect(Collectors.toList());
                
                // Get compensated decryption shares from database (for THIS CHUNK)
                List<String> missingGuardianIds = new ArrayList<>();
                List<String> compensatingGuardianIds = new ArrayList<>();
                List<String> compensatedTallyShares = new ArrayList<>();
                List<String> compensatedBallotShares = new ArrayList<>();
                
                // ✅ Populate compensated decryption data for missing guardians
                // CRITICAL: Order must match - each index in all arrays corresponds to the same compensated share
                // Example: missing=[4,4,4,5,5,5], compensating=[1,2,3,1,2,3] means:
                //   Index 0: Guardian 1 compensating for Guardian 4
                //   Index 1: Guardian 2 compensating for Guardian 4
                //   Index 2: Guardian 3 compensating for Guardian 4
                //   Index 3: Guardian 1 compensating for Guardian 5
                //   etc.
                if (!missingGuardians.isEmpty()) {
                    
                    // Sort missing guardians by sequence_order for consistent ordering
                    missingGuardians.sort((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()));

                    for (Guardian missingGuardian : missingGuardians) {
                        
                        // Get all compensated decryptions for this missing guardian in this chunk
                        List<CompensatedDecryption> compensatedDecryptions = compensatedDecryptionRepository
                            .findByElectionCenterIdAndMissingGuardianId(
                                electionCenter.getElectionCenterId(),
                                missingGuardian.getGuardianId()
                            );
                        
                        
                        if (!compensatedDecryptions.isEmpty()) {
                            // Create a map of compensating guardian ID -> CompensatedDecryption for sorting
                            Map<Long, CompensatedDecryption> cdMap = new HashMap<>();
                            for (CompensatedDecryption cd : compensatedDecryptions) {
                                cdMap.put(cd.getCompensatingGuardianId(), cd);
                            }
                            
                            // Sort available guardians by sequence_order to ensure consistent ordering
                            List<Guardian> sortedAvailableGuardians = availableGuardians.stream()
                                .sorted((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()))
                                .collect(Collectors.toList());
                            
                            
                            
                            // Add compensated shares in order: for each missing guardian, 
                            // add all compensating guardians' shares in sequence_order
                            int addedForThisGuardian = 0;
                            for (Guardian compensatingGuardian : sortedAvailableGuardians) {
                                CompensatedDecryption cd = cdMap.get(compensatingGuardian.getGuardianId());
                                if (cd != null) {
                                    int currentIndex = missingGuardianIds.size();
                                    missingGuardianIds.add(String.valueOf(missingGuardian.getSequenceOrder()));
                                    compensatingGuardianIds.add(String.valueOf(compensatingGuardian.getSequenceOrder()));
                                    compensatedTallyShares.add(cd.getCompensatedTallyShare());
                                    compensatedBallotShares.add(cd.getCompensatedBallotShare());
                                    addedForThisGuardian++;
                                    
                                } else {
                                }
                            }
                        } else {
                        }
                    }
                    
                    // Log the final arrays for verification
                    
                    
                    if (missingGuardianIds.size() == missingGuardians.size() * availableGuardians.size()) {
                    } else {
                    }
                }

                // Get encrypted tally from THIS chunk's ElectionCenter
                String ciphertextTallyString = electionCenter.getEncryptedTally();
                if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Encrypted tally not found in election center " + electionCenter.getElectionCenterId())
                        .build();
                }
                
                // Build request — all complex fields must be parsed from JSON strings to
                // native Java objects so msgpack encodes them as maps/dicts (not strings)
                ElectionGuardCombineDecryptionSharesRequest guardRequest = ElectionGuardCombineDecryptionSharesRequest.builder()
                    .party_names(partyNames)
                    .candidate_names(candidateNames)
                    .joint_public_key(election.getJointPublicKey())
                    .commitment_hash(election.getBaseHash())
                    .ciphertext_tally(parseJsonToObject(ciphertextTallyString))
                    .submitted_ballots(parseJsonStringList(ballotCipherTexts))
                    .guardian_data(parseJsonStringList(guardianDataList))
                    .available_guardian_ids(availableGuardianIds)
                    .available_guardian_public_keys(availableGuardianPublicKeys)
                    .available_tally_shares(parseJsonStringList(availableTallyShares))
                    .available_ballot_shares(parseJsonStringList(availableBallotShares))
                    .missing_guardian_ids(missingGuardianIds)
                    .compensating_guardian_ids(compensatingGuardianIds)
                    .compensated_tally_shares(parseJsonStringList(compensatedTallyShares))
                    .compensated_ballot_shares(parseJsonStringList(compensatedBallotShares))
                    .quorum(quorum)
                    .number_of_guardians(guardians.size())
                    .build();

                ElectionGuardCombineDecryptionSharesResponse guardResponse = callElectionGuardCombineDecryptionSharesService(guardRequest);

                // Process the response string to extract results and save to election_result
                if ("success".equals(guardResponse.status())) {
                    // Save chunk result to THIS chunk's election_result
                    electionCenter.setElectionResult(toJsonString(guardResponse.results()));
                    electionCenterRepository.save(electionCenter);
                } else {
                    System.err.println("❌ ElectionGuard combine decryption failed for chunk " + electionCenter.getElectionCenterId() + ": " + guardResponse.status());
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Failed to combine partial decryption for chunk " + electionCenter.getElectionCenterId() + ": " + guardResponse.status())
                        .build();
                }
                
                
                // MEMORY-EFFICIENT: Clear references and force garbage collection
                chunkSubmittedBallots.clear();
                ballotCipherTexts.clear();
                decryptions.clear();
                guardianDecryptionMap.clear();
                guardianDataList.clear();
                availableGuardianIds.clear();
                availableGuardianPublicKeys.clear();
                availableTallyShares.clear();
                availableBallotShares.clear();
                missingGuardianIds.clear();
                compensatingGuardianIds.clear();
                compensatedTallyShares.clear();
                compensatedBallotShares.clear();
                
                // ✅ AGGRESSIVE GC AFTER EVERY COMBINE CHUNK
                System.gc();
                System.gc(); // Second pass
                
                // Log memory every 10 chunks
                if (processedChunkCount % 10 == 0) {
                    Runtime runtime = Runtime.getRuntime();
                    long usedMB = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
                }
            }
            
            // Removed: updateCombineStatus call - status is now queried directly from database
            
            // After processing all chunks, fetch all centers to build aggregated results
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
            Object aggregatedResults = buildAggregatedResultsFromChunks(electionCenters);
            updateElectionChoicesWithResults(request.election_id(), aggregatedResults, electionChoices);
            
            // Update election status to 'decrypted'
            election.setStatus("decrypted");
            electionRepository.save(election);
            
            
            return CombinePartialDecryptionResponse.builder()
                .success(true)
                .message("Election results successfully decrypted and ready for viewing")
                .results(aggregatedResults)
                .build();

        } catch (Exception e) {
            System.err.println("Error combining partial decryption: " + e.getMessage());
            // Stack trace available in exception: e
            return CombinePartialDecryptionResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }

    private void updateElectionChoicesWithResults(Long electionId, Object results, List<ElectionChoice> electionChoices) {
        try {
            
            // Parse the results object to extract vote counts
            @SuppressWarnings("unchecked")
            Map<String, Object> resultsMap = (Map<String, Object>) results;
            
            @SuppressWarnings("unchecked")
            Map<String, Object> resultsSection = (Map<String, Object>) resultsMap.get("results");
            
            if (resultsSection == null) {
                System.err.println("No 'results' section found in the response");
                return;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> candidates = (Map<String, Object>) resultsSection.get("candidates");
            
            if (candidates == null) {
                System.err.println("No 'candidates' section found in results");
                return;
            }
            
            // Update each election choice with its vote count
            for (ElectionChoice choice : electionChoices) {
                String candidateName = choice.getOptionTitle();
                
                @SuppressWarnings("unchecked")
                Map<String, Object> candidateData = (Map<String, Object>) candidates.get(candidateName);
                
                if (candidateData != null) {
                    Object votesObj = candidateData.get("votes");
                    if (votesObj != null) {
                        try {
                            // Handle both String and Integer vote counts
                            int voteCount;
                            if (votesObj instanceof String str) {
                                voteCount = Integer.parseInt(str);
                            } else if (votesObj instanceof Integer num) {
                                voteCount = num;
                            } else {
                                voteCount = 0;
                                System.err.println("Unexpected vote type for candidate " + candidateName + ": " + votesObj.getClass());
                            }
                            
                            choice.setTotalVotes(voteCount);
                        } catch (NumberFormatException e) {
                            System.err.println("Failed to parse vote count for candidate " + candidateName + ": " + votesObj);
                            choice.setTotalVotes(0);
                        }
                    } else {
                        System.err.println("No vote count found for candidate: " + candidateName);
                        choice.setTotalVotes(0);
                    }
                } else {
                    System.err.println("No data found for candidate: " + candidateName);
                    choice.setTotalVotes(0);
                }
            }
            
            // Save all updated election choices
            electionChoiceRepository.saveAll(electionChoices);
            
        } catch (Exception e) {
            System.err.println("Error updating election choices with results: " + e.getMessage());
            // Stack trace available in exception: e
            // Don't throw the exception here as we still want to return the results to frontend
        }
    }

    /**
     * Creates compensated decryption shares for ALL other guardians using the available guardian (MEMORY-EFFICIENT)
     */
    private void createCompensatedDecryptionShares(Election election, Guardian availableGuardian, String availableGuardianPrivateKey, String availableGuardianPolynomial, List<Long> electionCenterIds) {
        try {
            
            // Get all guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(election.getElectionId());
            
            // Get ALL other guardians (excluding the current guardian who is creating compensated shares)
            List<Guardian> otherGuardians = allGuardians.stream()
                .filter(g -> !g.getSequenceOrder().equals(availableGuardian.getSequenceOrder()))
                .collect(Collectors.toList());
            
            // Create compensated shares for ALL other guardians for EACH chunk
            if (otherGuardians.isEmpty()) {
                return;
            }
            
            
            int totalOperations = electionCenterIds.size() * otherGuardians.size();
            int completedOperations = 0;
            
            // Process each chunk (MEMORY-EFFICIENT)
            for (int chunkIndex = 0; chunkIndex < electionCenterIds.size(); chunkIndex++) {
                Long electionCenterId = electionCenterIds.get(chunkIndex);
                
                // MEMORY-EFFICIENT: Fetch only the election center needed for this iteration
                Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
                if (!electionCenterOpt.isPresent()) {
                    System.err.println("❌ Election center not found: " + electionCenterId);
                    continue;
                }
                ElectionCenter electionCenter = electionCenterOpt.get();
                
                int createdCount = 0;
                int skippedCount = 0;
                
                // For each OTHER guardian, create compensated share using the current guardian
                for (Guardian otherGuardian : otherGuardians) {
                    // Check if compensated share from THIS SPECIFIC guardian for this chunk already exists
                    boolean alreadyExists = compensatedDecryptionRepository
                        .existsByElectionCenterIdAndCompensatingGuardianIdAndMissingGuardianId(
                            electionCenterId,
                            availableGuardian.getGuardianId(),
                            otherGuardian.getGuardianId()
                        );
                    
                    
                    if (!alreadyExists) {
                        // Create compensated share from this guardian for the other guardian for this chunk
                        createCompensatedShare(election, electionCenter, availableGuardian, otherGuardian, availableGuardianPrivateKey, availableGuardianPolynomial);
                        createdCount++;
                        completedOperations++;
                    } else {
                        skippedCount++;
                        completedOperations++;
                    }
                }
                
                
                // ✅ Periodic GC hint every 50 chunks (not every chunk - avoid overhead)
                if ((chunkIndex + 1) % 50 == 0 || (chunkIndex + 1) == electionCenterIds.size()) {
                    suggestGCIfNeeded(completedOperations, totalOperations, "Compensated Decryption");
                }
            }
            
            
        } catch (Exception e) {
            System.err.println("\n" + "=".repeat(80));
            System.err.println("❌ ERROR CREATING COMPENSATED DECRYPTION SHARES");
            System.err.println("Guardian: " + availableGuardian.getSequenceOrder());
            System.err.println("Error: " + e.getMessage());
            System.err.println("=".repeat(80));
            // Stack trace available in exception: e
        }
    }
    
    /**
     * Creates a compensated decryption share for a specific other guardian using a compensating guardian for a specific chunk
     * Each call processes one compensated share in its own transaction
     */
    @Transactional
    private void createCompensatedShare(Election election, ElectionCenter electionCenter, Guardian compensatingGuardian, Guardian otherGuardian, String compensatingGuardianPrivateKey, String compensatingGuardianPolynomial) {
        try {
            
            // Validate that polynomial is provided since Guardian table doesn't store it
            if (compensatingGuardianPolynomial == null || compensatingGuardianPolynomial.trim().isEmpty()) {
                System.err.println("Compensating guardian polynomial is required but not provided");
                return;
            }
            
            // Check if compensated share already exists for this chunk
            boolean existsAlready = compensatedDecryptionRepository
                .existsByElectionCenterIdAndCompensatingGuardianIdAndMissingGuardianId(
                    electionCenter.getElectionCenterId(),
                    compensatingGuardian.getGuardianId(),
                    otherGuardian.getGuardianId());
            
            if (existsAlready) {
                return;
            }
            
            // Build request to microservice
            // Get election choices for party and candidate names
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .filter(partyName -> partyName != null && !partyName.trim().isEmpty())
                .distinct()
                .collect(Collectors.toList());
            
            // Get submitted ballots for THIS CHUNK
            List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionCenterId(electionCenter.getElectionCenterId());
            List<String> ballotCipherTexts = submittedBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .collect(Collectors.toList());
            
            // Get guardian_data from key_backup field (contains full ElectionGuard guardian data)
            // Use key_backup if available, otherwise construct minimal guardian data
            String availableGuardianDataJson;
            if (compensatingGuardian.getKeyBackup() != null && !compensatingGuardian.getKeyBackup().trim().isEmpty()) {
                availableGuardianDataJson = compensatingGuardian.getKeyBackup();
            } else {
                // Fallback: construct minimal guardian data
                availableGuardianDataJson = String.format(
                    "{\"id\":\"%s\",\"sequence_order\":%d}",
                    compensatingGuardian.getSequenceOrder(),
                    compensatingGuardian.getSequenceOrder()
                );
            }
            
            String missingGuardianDataJson;
            if (otherGuardian.getKeyBackup() != null && !otherGuardian.getKeyBackup().trim().isEmpty()) {
                missingGuardianDataJson = otherGuardian.getKeyBackup();
            } else {
                // Fallback: construct minimal guardian data
                missingGuardianDataJson = String.format(
                    "{\"id\":\"%s\",\"sequence_order\":%d}",
                    otherGuardian.getSequenceOrder(),
                    otherGuardian.getSequenceOrder()
                );
            }
            
            // Build request — all complex fields must be parsed from JSON strings to
            // native Java objects so msgpack encodes them as maps/dicts (not strings)
            ElectionGuardCompensatedDecryptionRequest request = ElectionGuardCompensatedDecryptionRequest.builder()
                .available_guardian_id(String.valueOf(compensatingGuardian.getSequenceOrder()))
                .missing_guardian_id(String.valueOf(otherGuardian.getSequenceOrder()))
                .available_guardian_data(parseJsonToObject(availableGuardianDataJson))
                .missing_guardian_data(parseJsonToObject(missingGuardianDataJson))
                .available_private_key(parseJsonToObject(compensatingGuardianPrivateKey))
                .available_public_key(parseJsonToObject(compensatingGuardian.getGuardianPublicKey()))
                .available_polynomial(parseJsonToObject(compensatingGuardianPolynomial))
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .ciphertext_tally(parseJsonToObject(electionCenter.getEncryptedTally()))
                .submitted_ballots(parseJsonStringList(ballotCipherTexts))
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .number_of_guardians(guardianRepository.findByElectionId(election.getElectionId()).size())
                .quorum(election.getElectionQuorum())
                .build();
            
            // Call microservice
            ElectionGuardCompensatedDecryptionResponse response = callElectionGuardCompensatedDecryptionService(request);
            
            if (response == null || response.compensated_tally_share() == null) {
                System.err.println("Failed to get compensated decryption response from microservice");
                return;
            }
            
            // Save compensated decryption to database (linked to chunk)
            CompensatedDecryption compensatedDecryption = new CompensatedDecryption();
            compensatedDecryption.setElectionCenterId(electionCenter.getElectionCenterId());
            compensatedDecryption.setCompensatingGuardianId(compensatingGuardian.getGuardianId());
            compensatedDecryption.setMissingGuardianId(otherGuardian.getGuardianId());
            // Note: CompensatedDecryption uses guardian IDs, not sequence numbers directly
            compensatedDecryption.setCompensatedTallyShare(toJsonString(response.compensated_tally_share()));
            compensatedDecryption.setCompensatedBallotShare(toJsonString(response.compensated_ballot_shares()));
            
            compensatedDecryptionRepository.save(compensatedDecryption);
            
            
            // ✅ AGGRESSIVE MEMORY CLEANUP
            entityManager.flush();
            entityManager.clear();
            
            // Clear large collections; local variables go out of scope at method end
            submittedBallots.clear();
            ballotCipherTexts.clear();
            
            // Suggest garbage collection
            System.gc();
            
            
        } catch (Exception e) {
            System.err.println("Error creating compensated share: " + e.getMessage());
            // Stack trace available in exception: e
        }
    }
    
    /**
     * Calls the ElectionGuard microservice to create compensated decryption
     */
    private ElectionGuardCompensatedDecryptionResponse callElectionGuardCompensatedDecryptionService(
            ElectionGuardCompensatedDecryptionRequest request) {
        try {
            String url = "/create_compensated_decryption";
            
            
            String response = electionGuardService.postRequest(url, request);
            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            ElectionGuardCompensatedDecryptionResponse parsedResponse = objectMapper.readValue(response, ElectionGuardCompensatedDecryptionResponse.class);
            
            return parsedResponse;
                
        } catch (Exception e) {
            System.err.println("Error calling ElectionGuard compensated decryption service: " + e.getMessage());
            return null;
        }
    }

    /**
     * Calls the ElectionGuard microservice to combine decryption shares with quorum support
     */
    private ElectionGuardCombineDecryptionSharesResponse callElectionGuardCombineDecryptionSharesService(
            ElectionGuardCombineDecryptionSharesRequest request) {
        try {
            String url = "/combine_decryption_shares";
            
            
            String response = electionGuardService.postRequest(url, request);
            

            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            ElectionGuardCombineDecryptionSharesResponse parsedResponse = objectMapper.readValue(response, ElectionGuardCombineDecryptionSharesResponse.class);
            
            return parsedResponse;
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard combine decryption shares service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard combine decryption shares service", e);
        }
    }

    /**
     * Get election results from cached election_result data
     * Returns null if results haven't been computed yet
     */
    public Object getElectionResults(Long electionId) {
        return getElectionResults(electionId, true);
    }

    public Object getElectionResults(Long electionId, boolean includeBallots) {
        try {
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            
            if (electionCenters == null || electionCenters.isEmpty()) {
                return null;
            }
            
            // Check if any chunks have results
            boolean anyChunkHasResults = electionCenters.stream()
                .anyMatch(ec -> ec.getElectionResult() != null && !ec.getElectionResult().trim().isEmpty());
            
            if (!anyChunkHasResults) {
                return null;
            }
            
            // Build and return aggregated results
            return buildAggregatedResultsFromChunks(electionCenters, includeBallots);
            
        } catch (Exception e) {
            System.err.println("Error getting election results: " + e.getMessage());
            // Stack trace available in exception: e
            return null;
        }
    }

    /**
     * Paginated ballot list for the Ballots in Tally tab.
     * Search runs across all ballots server-side; only one page is returned per request.
     */
    public Map<String, Object> getElectionBallotsPaginated(
            Long electionId,
            int page,
            int size,
            String search,
            String sortBy,
            String sortOrder) {
        try {
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            if (electionCenters == null || electionCenters.isEmpty()) {
                return Map.of("success", false, "message", "Results not yet available");
            }

            List<Map<String, Object>> allBallots = extractAllBallotsFromCenters(electionCenters);
            if (allBallots.isEmpty()) {
                return Map.of(
                    "success", true,
                    "ballots", List.of(),
                    "total", 0,
                    "page", Math.max(page, 0),
                    "size", normalizeBallotPageSize(size),
                    "statusCounts", Map.of()
                );
            }

            String normalizedSearch = search != null ? search.trim().toLowerCase() : "";
            List<Map<String, Object>> filtered = allBallots;
            if (!normalizedSearch.isEmpty()) {
                filtered = allBallots.stream()
                    .filter(ballot -> ballotMatchesSearch(ballot, normalizedSearch))
                    .toList();
            }

            String resolvedSortBy = sortBy != null && !sortBy.isBlank() ? sortBy : "ballot_id";
            boolean ascending = sortOrder == null || !sortOrder.equalsIgnoreCase("desc");
            filtered = new ArrayList<>(filtered);
            filtered.sort((a, b) -> compareBallots(a, b, resolvedSortBy, ascending));

            int safePage = Math.max(page, 0);
            int safeSize = normalizeBallotPageSize(size);
            int total = filtered.size();
            int fromIndex = Math.min(safePage * safeSize, total);
            int toIndex = Math.min(fromIndex + safeSize, total);
            List<Map<String, Object>> pageBallots = filtered.subList(fromIndex, toIndex);

            return Map.of(
                "success", true,
                "ballots", pageBallots,
                "total", total,
                "page", safePage,
                "size", safeSize,
                "statusCounts", computeBallotStatusCounts(allBallots)
            );
        } catch (Exception e) {
            System.err.println("Error getting paginated election ballots: " + e.getMessage());
            return Map.of("success", false, "message", "Internal server error: " + e.getMessage());
        }
    }

    private int normalizeBallotPageSize(int size) {
        if (size <= 0) {
            return 30;
        }
        return Math.min(size, 200);
    }

    private List<Map<String, Object>> extractAllBallotsFromCenters(List<ElectionCenter> electionCenters) {
        List<Map<String, Object>> allBallots = new ArrayList<>();
        for (int i = 0; i < electionCenters.size(); i++) {
            ElectionCenter chunk = electionCenters.get(i);
            if (chunk.getElectionResult() == null || chunk.getElectionResult().trim().isEmpty()) {
                continue;
            }
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> chunkData = objectMapper.readValue(chunk.getElectionResult(), Map.class);
                @SuppressWarnings("unchecked")
                Map<String, Object> verification = (Map<String, Object>) chunkData.get("verification");
                if (verification == null) {
                    continue;
                }
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> ballots = (List<Map<String, Object>>) verification.get("ballots");
                if (ballots == null) {
                    continue;
                }
                for (Map<String, Object> ballot : ballots) {
                    ballot.put("chunkIndex", i + 1);
                    allBallots.add(ballot);
                }
            } catch (Exception e) {
                System.err.println("Error extracting ballots from chunk " + (i + 1) + ": " + e.getMessage());
            }
        }
        return allBallots;
    }

    private boolean ballotMatchesSearch(Map<String, Object> ballot, String normalizedSearch) {
        String ballotId = stringValue(ballot.get("ballot_id")).toLowerCase();
        String initialHash = stringValue(ballot.get("initial_hash")).toLowerCase();
        String decryptedHash = stringValue(ballot.get("decrypted_hash")).toLowerCase();
        String verification = stringValue(ballot.get("verification")).toLowerCase();
        String status = stringValue(ballot.get("status")).toLowerCase();
        return ballotId.contains(normalizedSearch)
            || initialHash.contains(normalizedSearch)
            || decryptedHash.contains(normalizedSearch)
            || verification.contains(normalizedSearch)
            || status.contains(normalizedSearch);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private int compareBallots(
            Map<String, Object> a,
            Map<String, Object> b,
            String sortBy,
            boolean ascending) {
        String aValue = stringValue(a.get(sortBy)).toLowerCase();
        String bValue = stringValue(b.get(sortBy)).toLowerCase();
        int cmp = aValue.compareTo(bValue);
        return ascending ? cmp : -cmp;
    }

    private Map<String, Integer> computeBallotStatusCounts(List<Map<String, Object>> ballots) {
        Map<String, Integer> counts = new HashMap<>();
        for (Map<String, Object> ballot : ballots) {
            incrementCount(counts, stringValue(ballot.get("verification")));
            incrementCount(counts, stringValue(ballot.get("status")));
        }
        return counts;
    }

    private void incrementCount(Map<String, Integer> counts, String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        counts.put(key, counts.getOrDefault(key, 0) + 1);
    }

    /**
     * Parses the results string from the microservice response
     */

    /**
     * Builds aggregated results from all chunk election_result data
     * Combines per-chunk results into a single comprehensive result object
     */
    private Object buildAggregatedResultsFromChunks(List<ElectionCenter> electionCenters) {
        return buildAggregatedResultsFromChunks(electionCenters, true);
    }

    private Object buildAggregatedResultsFromChunks(List<ElectionCenter> electionCenters, boolean includeBallots) {
        try {
            Map<String, Object> aggregatedResult = new HashMap<>();
            List<Map<String, Object>> chunkResults = new ArrayList<>();
            Map<String, Integer> finalTallies = new HashMap<>();
            List<Map<String, Object>> allBallots = new ArrayList<>();
            int totalBallotCount = 0;
            
            // Process each chunk
            for (int i = 0; i < electionCenters.size(); i++) {
                ElectionCenter chunk = electionCenters.get(i);
                if (chunk.getElectionResult() != null && !chunk.getElectionResult().trim().isEmpty()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> chunkData = objectMapper.readValue(chunk.getElectionResult(), Map.class);
                    
                    // Extract chunk-specific results
                    @SuppressWarnings("unchecked")
                    Map<String, Object> resultsSection = (Map<String, Object>) chunkData.get("results");
                    
                    if (resultsSection != null) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> candidates = (Map<String, Object>) resultsSection.get("candidates");
                        
                        // Extract vote counts from candidates (handle nested structure)
                        Map<String, Integer> candidateVoteCounts = new HashMap<>();
                        if (candidates != null) {
                            for (Map.Entry<String, Object> entry : candidates.entrySet()) {
                                String candidateName = entry.getKey();
                                Object value = entry.getValue();
                                int votes = 0;
                                
                                if (value instanceof Number num) {
                                    votes = num.intValue();
                                } else if (value instanceof Map map) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> voteData = (Map<String, Object>) map;
                                    Object votesObj = voteData.get("votes");
                                    if (votesObj instanceof Number vNum) {
                                        votes = vNum.intValue();
                                    } else if (votesObj instanceof String vStr) {
                                        try {
                                            votes = Integer.parseInt(vStr);
                                        } catch (NumberFormatException e) {
                                            System.err.println("Failed to parse votes for " + candidateName + ": " + votesObj);
                                        }
                                    }
                                }
                                candidateVoteCounts.put(candidateName, votes);
                            }
                        }
                        
                        // Build per-chunk result
                        Map<String, Object> chunkResult = new HashMap<>();
                        chunkResult.put("chunkIndex", i + 1);
                        chunkResult.put("electionCenterId", chunk.getElectionCenterId());
                        // Include the stored encrypted tally ciphertext for this chunk so frontend can display it
                        chunkResult.put("encryptedTally", chunk.getEncryptedTally());
                        chunkResult.put("candidateVotes", candidateVoteCounts);
                        
                        // Extract ballot information
                        @SuppressWarnings("unchecked")
                        Map<String, Object> verification = (Map<String, Object>) chunkData.get("verification");
                        if (verification != null) {
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> ballots = (List<Map<String, Object>>) verification.get("ballots");
                            if (ballots != null) {
                                chunkResult.put("ballotCount", ballots.size());
                                totalBallotCount += ballots.size();
                                if (includeBallots) {
                                    for (Map<String, Object> ballot : ballots) {
                                        ballot.put("chunkIndex", i + 1);
                                        allBallots.add(ballot);
                                    }
                                }
                            }
                        }
                        
                        chunkResults.add(chunkResult);
                        
                        // Aggregate tallies - handle nested votes structure
                        if (candidates != null) {
                            for (Map.Entry<String, Object> entry : candidates.entrySet()) {
                                String candidateName = entry.getKey();
                                int votes = 0;
                                
                                // Handle both simple number and nested object formats
                                Object value = entry.getValue();
                                if (value instanceof Number num) {
                                    votes = num.intValue();
                                } else if (value instanceof Map map) {
                                    // Extract votes from nested object: {"votes": "2", "percentage": "50.0"}
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> voteData = (Map<String, Object>) map;
                                    Object votesObj = voteData.get("votes");
                                    if (votesObj instanceof Number vNum) {
                                        votes = vNum.intValue();
                                    } else if (votesObj instanceof String vStr) {
                                        try {
                                            votes = Integer.parseInt(vStr);
                                        } catch (NumberFormatException e) {
                                            System.err.println("Failed to parse votes for " + candidateName + ": " + votesObj);
                                        }
                                    }
                                }
                                
                                finalTallies.put(candidateName, finalTallies.getOrDefault(candidateName, 0) + votes);
                            }
                        }
                    }
                }
            }
            
            // Build final aggregated response
            aggregatedResult.put("chunks", chunkResults);
            aggregatedResult.put("finalTallies", finalTallies);
            aggregatedResult.put("totalChunks", electionCenters.size());
            int ballotTotal = includeBallots ? allBallots.size() : totalBallotCount;
            aggregatedResult.put("allBallots", includeBallots ? allBallots : List.of());
            aggregatedResult.put("total_ballots_cast", ballotTotal);
            aggregatedResult.put("total_valid_ballots", ballotTotal);
            
            return aggregatedResult;
            
        } catch (Exception e) {
            System.err.println("Error building aggregated results: " + e.getMessage());
            // Stack trace available in exception: e
            return new HashMap<>();
        }
    }

    /**
     * Recursively walk a parsed Object tree and convert any BigInteger values to their
     * decimal String representation. msgpack cannot serialize BigInteger > 2^64-1, but
     * ElectionGuard produces cryptographic integers larger than that. They must be
     * transmitted as strings.
     */
    @SuppressWarnings("unchecked")
    private Object sanitizeForMsgpack(Object obj) {
        if (obj == null) return null;
        if (obj instanceof java.math.BigInteger) return obj.toString();
        if (obj instanceof java.util.Map) {
            java.util.Map<Object, Object> result = new java.util.LinkedHashMap<>();
            ((java.util.Map<?, ?>) obj).forEach((k, v) -> result.put(k, sanitizeForMsgpack(v)));
            return result;
        }
        if (obj instanceof java.util.List) {
            java.util.List<Object> result = new java.util.ArrayList<>();
            ((java.util.List<?>) obj).forEach(item -> result.add(sanitizeForMsgpack(item)));
            return result;
        }
        return obj;
    }

    /**
     * Parse a JSON string to a Java Object (Map/List) so that msgpack serializes it as a
     * native dict/list (not a string). The Python microservice expects complex fields as
     * msgpack maps, not msgpack str.
     */
    private Object parseJsonToObject(String json) {
        if (json == null || json.trim().isEmpty()) return null;
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            return sanitizeForMsgpack(parsed);
        } catch (Exception e) {
            return json; // fallback: return as-is
        }
    }

    /**
     * Parse a list of JSON strings to a list of Java Objects for msgpack serialization.
     */
    private List<Object> parseJsonStringList(List<String> jsonList) {
        if (jsonList == null) return new java.util.ArrayList<>();
        List<Object> result = new java.util.ArrayList<>();
        for (String json : jsonList) {
            result.add(parseJsonToObject(json));
        }
        return result;
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
