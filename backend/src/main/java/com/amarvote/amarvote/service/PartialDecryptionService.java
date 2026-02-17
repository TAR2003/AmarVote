package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
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
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
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
    private final ElectionChoiceRepository electionChoiceRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final DecryptionRepository decryptionRepository;
    private final ObjectMapper objectMapper;
    private final ElectionGuardCryptoService cryptoService;
    
    // Concurrent lock to prevent multiple decryption processes for same guardian
    private final ConcurrentHashMap<String, Boolean> decryptionLocks = new ConcurrentHashMap<>();
    
    // Concurrent lock to prevent multiple combine processes for same election
    private final ConcurrentHashMap<Long, Boolean> combineLocks = new ConcurrentHashMap<>();
    
    @Autowired
    private ElectionGuardService electionGuardService;
    
    @Autowired
    private DecryptionTaskQueueService decryptionTaskQueueService;
    
    @Autowired
    private CredentialCacheService credentialCacheService;
    
    @Autowired
    private TaskLogService taskLogService;

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
     * NOTE: @Transactional removed to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processPartialDecryptionChunkTransactional().
     */
    public CreatePartialDecryptionResponse createPartialDecryption(CreatePartialDecryptionRequest request, String userEmail) {
        try {
            System.out.println("=== Starting Partial Decryption Process ===");
            System.out.println("Election ID: " + request.election_id() + ", User: " + userEmail);
            
            // 1. Find guardian record for this user and election
            List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(request.election_id(), userEmail);
            if (guardians.isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("User is not a guardian for this election")
                    .build();
            }
            Guardian guardian = guardians.get(0); // Should be only one
            
            // 🔥 LOG: Guardian partial decryption start
            com.amarvote.amarvote.model.TaskLog partialDecryptionTaskLog = taskLogService.logGuardianTaskStart(
                request.election_id(),
                "GUARDIAN_PARTIAL_DECRYPTION",
                "Guardian " + guardian.getSequenceOrder() + " computing partial decryption shares",
                userEmail,
                guardian.getGuardianId()
            );
            System.out.println("📝 Task log created: ID=" + partialDecryptionTaskLog.getLogId() + 
                " | Task: Guardian " + guardian.getSequenceOrder() + " Partial Decryption | User: " + userEmail);

            // 3. Get election information
            Optional<Election> electionOpt = electionRepository.findById(request.election_id());
            if (!electionOpt.isPresent()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            Election election = electionOpt.get();

            // 4. Get election choices for candidate names and party names
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.election_id());
            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            List<String> candidateNames = choices.stream()
                .map(ElectionChoice::getOptionTitle)
                .toList();
            List<String> partyNames = choices.stream()
                .map(ElectionChoice::getPartyName)
                .toList();

            // 5. Get number of guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
            int numberOfGuardians = allGuardians.size();

            // ===== CRITICAL CHECK: Tally must exist before guardian key submission =====
            // Check if encrypted tally exists (check election_center table for chunks)
            // MEMORY-EFFICIENT: Fetch only election center IDs first
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(request.election_id());
            System.out.println("=== TALLY VERIFICATION ===");
            System.out.println("Checking if encrypted tally exists for election " + request.election_id());
            System.out.println("Found " + electionCenterIds.size() + " chunk(s) in election_center table");
            
            if (electionCenterIds.isEmpty()) {
                System.out.println("❌ NO ENCRYPTED TALLY FOUND - GUARDIAN KEYS CANNOT BE SUBMITTED");
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Tally has not been created yet. Please create the tally before submitting guardian keys.")
                    .build();
            }
            
            System.out.println("✅ TALLY EXISTS - PROCEEDING WITH GUARDIAN KEY SUBMISSION");
            
            // Continue with normal partial decryption process
            System.out.println("=== PROCESSING GUARDIAN CREDENTIALS ===");
            
            // 6. Decrypt guardian credentials using the encrypted_data from request
            String guardianCredentials = guardian.getCredentials();
            if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Guardian credentials not found. Please contact the administrator.")
                    .build();
            }

            String decryptedPrivateKey;
            String decryptedPolynomial;
            try {
                System.out.println("Decrypting guardian credentials...");
                ElectionGuardCryptoService.GuardianDecryptionResult decryptionResult = cryptoService.decryptGuardianData(request.encrypted_data(), guardianCredentials);
                decryptedPrivateKey = decryptionResult.getPrivateKey();
                decryptedPolynomial = decryptionResult.getPolynomial();
                System.out.println("Successfully decrypted guardian private key and polynomial");
            } catch (Exception e) {
                System.err.println("Failed to decrypt guardian credentials: " + e.getMessage());
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to decrypt guardian credentials. Please ensure you uploaded the correct credential file.")
                    .build();
            }

            // 10. ===== PROCESS EACH CHUNK (MEMORY-EFFICIENT) =====
            System.out.println("=== PROCESSING " + electionCenterIds.size() + " CHUNKS ===");
            int processedChunks = 0;
            
            for (Long electionCenterId : electionCenterIds) {
                int chunkNumber = processedChunks + 1;
                System.out.println("=== PROCESSING CHUNK " + chunkNumber + " (election_center_id: " + electionCenterId + ") ===");
                
                try {
                    // Process chunk in isolated transaction
                    processPartialDecryptionChunkTransactional(
                        electionCenterId,
                        chunkNumber,
                        guardian,
                        decryptedPrivateKey,
                        decryptedPolynomial,
                        candidateNames,
                        partyNames,
                        numberOfGuardians,
                        election.getJointPublicKey(),
                        election.getBaseHash(),
                        election.getElectionQuorum()
                    );
                    
                    processedChunks++;
                    System.out.println("✅ Chunk " + chunkNumber + " completed successfully");
                    
                } catch (Exception e) {
                    System.err.println("❌ Error processing chunk " + chunkNumber + ": " + e.getMessage());
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Failed to process chunk " + chunkNumber + ": " + e.getMessage())
                        .build();
                }
            }
            
            System.out.println("=== PROCESSED " + processedChunks + " CHUNKS SUCCESSFULLY ===");
            
            // 🔒 DO NOT mark guardian as decrypted yet - wait until compensated shares complete
            // Mark guardian as having completed decryption AFTER compensated shares
            // guardian.setDecryptedOrNot(true); // MOVED TO AFTER COMPENSATED SHARES

            // Create compensated decryption shares for ALL other guardians using decrypted polynomial
            createCompensatedDecryptionShares(election, guardian, decryptedPrivateKey, decryptedPolynomial, electionCenterIds);
            
            // ✅ NOW mark guardian as fully decrypted (both phases complete)
            guardian.setDecryptedOrNot(true);
            guardianRepository.save(guardian);
            System.out.println("✅ Guardian marked as fully decrypted (both phases complete)");
            
            // 🔥 LOG: Guardian partial decryption complete
            taskLogService.logTaskComplete(partialDecryptionTaskLog);
            System.out.println("📝 Task log completed: ID=" + partialDecryptionTaskLog.getLogId() + 
                " | Duration: " + partialDecryptionTaskLog.getDurationMs() + "ms");

            return CreatePartialDecryptionResponse.builder()
                .success(true)
                .message("Partial decryption completed successfully for " + processedChunks + " chunks")
                .build();

        } catch (Exception e) {
            System.err.println("Error creating partial decryption: " + e.getMessage());
            return CreatePartialDecryptionResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }

    /**
     * Initiate decryption process (returns immediately, processes asynchronously)
     */
    public CreatePartialDecryptionResponse initiateDecryption(CreatePartialDecryptionRequest request, String userEmail) {
        try {
            System.out.println("=== Initiating Guardian Decryption Process ===");
            System.out.println("Election ID: " + request.election_id() + ", User: " + userEmail);
            
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
            
            // 3. Create lock key
            String lockKey = request.election_id() + "_" + guardian.getGuardianId();
            
            // 4. Check if decryption already exists or is in progress by querying database
            List<Long> allChunks = electionCenterRepository.findElectionCenterIdsByElectionId(request.election_id());
            long completedPartial = decryptionRepository.countByElectionIdAndGuardianId(request.election_id(), guardian.getGuardianId());
            List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
            int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);
            
            if (completedPartial > 0 && completedPartial < allChunks.size()) {
                System.out.println("⚠️ Decryption already in progress for guardian " + guardian.getGuardianId());
                return CreatePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Decryption is already in progress")
                    .build();
            }
            
            if (completedPartial >= allChunks.size()) {
                // Check if compensated shares are also done (if multi-guardian)
                if (totalCompensatedGuardians > 0) {
                    long completedCompensated = compensatedDecryptionRepository
                        .countByElectionIdAndCompensatingGuardianId(request.election_id(), guardian.getGuardianId());
                    long expectedCompensated = (long) allChunks.size() * totalCompensatedGuardians;
                    
                    if (completedCompensated >= expectedCompensated) {
                        System.out.println("✅ Decryption already completed for guardian " + guardian.getGuardianId());
                        return CreatePartialDecryptionResponse.builder()
                            .success(true)
                            .message("Decryption already completed for this guardian")
                            .build();
                    }
                } else {
                    System.out.println("✅ Decryption already completed for guardian " + guardian.getGuardianId());
                    return CreatePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Decryption already completed for this guardian")
                        .build();
                }
            }
            
            // 5. Try to acquire lock
            Boolean lockAcquired = decryptionLocks.putIfAbsent(lockKey, true);
            if (lockAcquired != null) {
                System.out.println("⚠️ Another decryption process is already running for this guardian");
                return CreatePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Decryption is already in progress")
                    .build();
            }
            
            try {
                // 7. Validate credentials BEFORE starting async processing
                System.out.println("🔑 Validating guardian credentials...");
                try {
                    String guardianCredentials = guardian.getCredentials();
                    if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
                        decryptionLocks.remove(lockKey);
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
                        decryptionLocks.remove(lockKey);
                        return CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("The credential file you provided is incorrect. Please upload the correct credentials.txt file that was sent to you via email.")
                            .build();
                    }
                    
                    System.out.println("✅ Credentials validated successfully");
                } catch (Exception validationError) {
                    System.err.println("❌ Credential validation failed: " + validationError.getMessage());
                    decryptionLocks.remove(lockKey);
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Invalid credential file. Please ensure you uploaded the correct credentials.txt file sent to you via email.")
                        .build();
                }
                
                System.out.println("✅ Starting async processing...");
                
                // 8. Start async processing (credentials already validated)
                processDecryptionAsync(request, userEmail, guardian);
                
                return CreatePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Credentials received successfully! Your decryption is being processed...")
                    .build();
                    
            } catch (Exception e) {
                // Release lock on error
                decryptionLocks.remove(lockKey);
                throw e;
            }
            
        } catch (Exception e) {
            System.err.println("Error initiating decryption: " + e.getMessage());
            // Stack trace available in exception: e
            return CreatePartialDecryptionResponse.builder()
                .success(false)
                .message("Failed to initiate decryption: " + e.getMessage())
                .build();
        }
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
     * Get current decryption status for a guardian
     * Queries RoundRobinTaskScheduler for real-time chunk processing state
     */
    public DecryptionStatusResponse getDecryptionStatus(Long electionId, Long guardianId) {
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
            long totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1); // All except self
            
            long totalChunks;
            long completedChunks;
            String currentPhase = null;
            
            if (partialTasks.isPresent()) {
                com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress partial = partialTasks.get();
                totalChunks = partial.getTotalChunks();
                completedChunks = partial.getCompletedChunks();
                
                if (!partial.isComplete()) {
                    currentPhase = "partial_decryption";
                }
            } else {
                // Partial task not in scheduler - get chunk count from database
                List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(electionId);
                totalChunks = electionCenterIds.size();
                completedChunks = decryptionRepository.countByElectionIdAndGuardianId(electionId, guardianId);
                System.out.println("📊 Partial task not in scheduler - using database: " + completedChunks + "/" + totalChunks);
            }
            
            long compensatedCompletedChunks = compensatedTasks.stream()
                .mapToLong(com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress::getCompletedChunks)
                .sum();
            
            // Determine current phase
            if (partialTasks.isPresent() && partialTasks.get().isComplete()) {
                // Partial decryption is complete, check if compensated is needed
                if (totalCompensatedGuardians > 0) {
                    // Need compensated decryption for other guardians
                    // ALWAYS check database first (primary source of truth)
                    long compensatedDecryptionCount = compensatedDecryptionRepository
                        .countByElectionIdAndCompensatingGuardianId(electionId, guardianId);
                    long expectedCompensatedCount = totalChunks * totalCompensatedGuardians;
                    
                    System.out.println("📊 Compensated progress check: " + compensatedDecryptionCount + "/" + expectedCompensatedCount);
                    
                    if (compensatedDecryptionCount < expectedCompensatedCount) {
                        // Compensated decryption is still in progress or not started
                        currentPhase = "compensated_shares_generation";
                        // Use database count if available, otherwise scheduler count
                        if (compensatedDecryptionCount > 0) {
                            compensatedCompletedChunks = compensatedDecryptionCount;
                        }
                    } else {
                        // All compensated decryption complete
                        System.out.println("✅ All compensated decryption complete");
                        currentPhase = "completed";
                    }
                }
            }
            
            long totalExpected = totalChunks * (1 + totalCompensatedGuardians);
            long totalProcessed = completedChunks + compensatedCompletedChunks;
            
            String status;
            // Use currentPhase as primary status indicator
            if (currentPhase == null) {
                // No phase determined yet
                if (totalProcessed == 0) {
                    status = "pending";
                    // If we have partial tasks, we're in partial_decryption phase
                    if (partialTasks.isPresent()) {
                        currentPhase = "partial_decryption";
                    }
                } else {
                    status = "in_progress";
                }
            } else if (currentPhase.equals("completed")) {
                // Explicitly set to completed
                status = "completed";
            } else if (currentPhase.equals("compensated_shares_generation") || currentPhase.equals("partial_decryption")) {
                // In active phase
                status = "in_progress";
            } else {
                // Default
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
                .build();
        }
        
        // No active task in scheduler - check database for completed decryption
        List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(electionId);
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
            // If user has initiated decryption, set phase even if no chunks completed yet
            // This will be overridden by the scheduler path above if tasks are active
            currentPhase = null; // Keep as null for not_started status
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
            .build();
    }

    /**
     * Process decryption asynchronously with detailed progress tracking (MEMORY-EFFICIENT)
     * NOTE: @Transactional removed from async method to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processChunkTransactional().
    */
    @Async
    public void processDecryptionAsync(CreatePartialDecryptionRequest request, String userEmail, 
                                       Guardian guardian) {
        String lockKey = request.election_id() + "_" + guardian.getGuardianId();
        
        try {
            System.out.println("=== ASYNC DECRYPTION STARTED (Memory-Efficient Mode) ===");
            System.out.println("Election ID: " + request.election_id() + ", Guardian: " + guardian.getUserEmail());
            
            // MEMORY-EFFICIENT: Fetch only election center IDs (not full objects)
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(request.election_id());
            System.out.println("✅ Found " + electionCenterIds.size() + " election center IDs (not loading full objects yet)");
            
            // Get all guardians to calculate total compensated guardians upfront
            List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
            // All other guardians except self (0 if single guardian)
            int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);
            
            if (totalCompensatedGuardians == 0) {
                System.out.println("👤 Single guardian election detected - no compensated shares needed");
            } else {
                System.out.println("👥 Multi-guardian election - will generate compensated shares for " + 
                    totalCompensatedGuardians + " other guardians");
            }
            
            System.out.println("=== Memory Monitoring Active ===");
            Runtime runtime = Runtime.getRuntime();
            long maxMemoryMB = runtime.maxMemory() / (1024 * 1024);
            System.out.println("Max heap size: " + maxMemoryMB + " MB");
            
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
            
            System.out.println("✅ Guardian credentials decrypted successfully");
            
            // ✅ SECURE: Store credentials in Redis (in-memory, auto-expiring) instead of database
            // Industry best practice for temporary sensitive data - no database breach exposure
            credentialCacheService.storePrivateKey(request.election_id(), guardian.getGuardianId(), decryptedPrivateKey);
            credentialCacheService.storePolynomial(request.election_id(), guardian.getGuardianId(), decryptedPolynomial);
            System.out.println("🔒 Guardian credentials stored securely in Redis with 1-hour TTL");
            
            // ✅ CRITICAL FIX: Queue ONLY partial decryption tasks first
            // Compensated tasks will be queued automatically AFTER all partial tasks complete
            System.out.println("=== PHASE 1: QUEUEING PARTIAL DECRYPTION TASKS (" + electionCenterIds.size() + " chunks) ===");
            System.out.println("⚠️ IMPORTANT: Compensated decryption tasks will be queued AFTER all partial tasks complete");
            
            decryptionTaskQueueService.queuePartialDecryptionTasks(
                request.election_id(),
                guardian.getGuardianId(),
                electionCenterIds,
                decryptedPrivateKey,
                decryptedPolynomial
            );
            
            System.out.println("✅ All partial decryption tasks queued");
            System.out.println("Workers will process chunks one at a time, releasing memory after each chunk");
            System.out.println("📋 Compensated decryption tasks will be automatically queued after Phase 1 completes");
            
            /* OLD CODE - Replaced with RabbitMQ queue-based processing
            // PHASE 1: Process each chunk for partial decryption (MEMORY-EFFICIENT)
            System.out.println("=== PHASE 1: PARTIAL DECRYPTION (" + electionCenterIds.size() + " chunks) ===");
            int processedChunks = 0;
            
            for (Long electionCenterId : electionCenterIds) {
                processedChunks++;
                
                long chunkStartTime = System.currentTimeMillis();
                System.out.println("=====================================================================");
                System.out.println("📦 Processing chunk " + processedChunks + "/" + electionCenterIds.size() 
                    + " (ID: " + electionCenterId + ")");
                System.out.println("🕐 Chunk start time: " + java.time.Instant.now());
                System.out.println("=====================================================================");
                
                // ... [loop processing code removed]
            }
            
            System.out.println("=====================================================================");
            System.out.println("✅ PHASE 1 COMPLETED: All " + processedChunks + " chunks processed");
            System.out.println("=====================================================================");
            
            // 🔒 DO NOT mark guardian as decrypted yet - wait until Phase 2 completes
            // guardian.setDecryptedOrNot(true); // MOVED TO AFTER PHASE 2
            
            // PHASE 2: Create compensated decryption shares for other guardians
            System.out.println("=== PHASE 2: COMPENSATED SHARES GENERATION ===");
            createCompensatedDecryptionSharesWithProgress(election, guardian, decryptedPrivateKey, 
                decryptedPolynomial, electionCenterIds);
            
            // ✅ NOW mark guardian as fully decrypted (both phases complete)
            markGuardianDecrypted(guardian);
            System.out.println("✅ Guardian marked as fully decrypted (both phases complete)");
            
            // Mark as completed
            updateDecryptionStatus(request.election_id(), guardian.getGuardianId(), "completed",
                "completed", processedChunks, electionCenterIds.size(), null, null, Instant.now());
            */
            
            System.out.println("🎉 DECRYPTION TASKS QUEUED SUCCESSFULLY");
            
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
            // Release lock
            decryptionLocks.remove(lockKey);
            System.out.println("🔓 Lock released for guardian " + guardian.getGuardianId());
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
        
        System.out.println("\n=== Processing Chunk " + chunkNumber + " (Transaction Start) ===");
        System.out.println("Fetching election center from database...");
        
        // Log memory before processing
        Runtime runtime = Runtime.getRuntime();
        long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        System.out.println("🧠 Memory before chunk " + chunkNumber + ": " + memoryBeforeMB + " MB");
        
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
        System.out.println("Found " + ballotCipherTexts.size() + " ballots for chunk " + chunkNumber + " (loaded as strings only)");
        
        // Construct guardian_data JSON with required fields
        String guardianDataJson = String.format(
            "{\"id\":\"%s\",\"sequence_order\":%d}",
            guardian.getSequenceOrder(),
            guardian.getSequenceOrder()
        );
        
        // Call ElectionGuard microservice for this chunk
        ElectionGuardPartialDecryptionRequest guardRequest = ElectionGuardPartialDecryptionRequest.builder()
            .guardian_id(String.valueOf(guardian.getSequenceOrder()))
            .guardian_data(guardianDataJson)
            .private_key(decryptedPrivateKey)
            .public_key(guardian.getGuardianPublicKey())
            .polynomial(decryptedPolynomial)
            .party_names(partyNames)
            .candidate_names(candidateNames)
            .ciphertext_tally(ciphertextTallyString)
            .submitted_ballots(ballotCipherTexts)
            .joint_public_key(jointPublicKey)
            .commitment_hash(baseHash)
            .number_of_guardians(numberOfGuardians)
            .quorum(quorum)
            .build();
        
        System.out.println("🚀 Calling ElectionGuard service for chunk " + chunkNumber);
        ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);
        System.out.println("Received response from ElectionGuard service for chunk " + chunkNumber);
        
        // Check if tally_share is null (invalid key)
        if (guardResponse.tally_share() == null) {
            throw new RuntimeException("Invalid credentials provided");
        }
        
        // Store decryption data for this chunk in the Decryption table
        Decryption decryption = Decryption.builder()
            .electionCenterId(electionCenterId)
            .guardianId(guardian.getGuardianId())
            .tallyShare(guardResponse.tally_share())
            .guardianDecryptionKey(guardResponse.guardian_public_key())
            .partialDecryptedTally(guardResponse.ballot_shares())
            .build();
        
        decryptionRepository.save(decryption);
        System.out.println("✅ Saved decryption data for chunk " + chunkNumber);
        
        // ✅ CRITICAL: Aggressive Hibernate memory cleanup
        entityManager.flush();   // Write pending changes to DB
        entityManager.clear();   // Clear persistence context - releases all entities
        
        // ✅ Explicitly null out large objects to help GC
        ballotCipherTexts.clear();
        ballotCipherTexts = null;
        electionCenter = null;
        guardResponse = null;
        decryption = null;
        guardianDataJson = null;
        ciphertextTallyString = null;
        guardRequest = null;
        
        // Log memory after cleanup
        long memoryAfterMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long freedMemoryMB = memoryBeforeMB - memoryAfterMB;
        System.out.println("✅ Chunk " + chunkNumber + " transaction complete - All entities detached and cleared");
        System.out.println("🗑️ Memory cleanup: EntityManager cleared, large objects nullified");
        System.out.println("🧠 Memory after chunk " + chunkNumber + ": " + memoryAfterMB + " MB (freed " + freedMemoryMB + " MB)");
    }

    /**
     * Save compensated decryption in a separate transaction
     */
    @Transactional
    private void saveCompensatedDecryptionTransactional(CompensatedDecryption compensatedDecryption) {
        compensatedDecryptionRepository.save(compensatedDecryption);
    }

    /**
     * Process single compensated decryption chunk in isolated transaction
     */
    /**
     * Create compensated decryption shares with progress tracking (MEMORY-EFFICIENT)
     */

    private ElectionGuardPartialDecryptionResponse callElectionGuardPartialDecryptionService(
            ElectionGuardPartialDecryptionRequest request) {
        
        long startTime = System.currentTimeMillis();
        String threadName = Thread.currentThread().getName();
        
        System.out.println("=====================================================================");
        System.out.println("⚙️ [BACKEND][Thread-" + threadName + "] CALLING ELECTIONGUARD MICROSERVICE");
        System.out.println("=====================================================================");
        System.out.println("📅 Timestamp: " + java.time.Instant.now());
        System.out.println("🎯 Endpoint: /create_partial_decryption");
        System.out.println("👥 Guardian ID: " + request.guardian_id());
        System.out.println("📦 Request contains:");
        System.out.println("   - Party names: " + (request.party_names() != null ? request.party_names().size() : "null"));
        System.out.println("   - Candidate names: " + (request.candidate_names() != null ? request.candidate_names().size() : "null"));
        System.out.println("   - Submitted ballots: " + (request.submitted_ballots() != null ? request.submitted_ballots().size() : "null"));
        System.out.println("   - Number of guardians: " + request.number_of_guardians());
        System.out.println("   - Quorum: " + request.quorum());
        System.out.println("=====================================================================");
        
        try {
            String url = "/create_partial_decryption";
            
            System.out.println("⏳ [BACKEND] Sending request to ElectionGuard service...");
            
            String response = electionGuardService.postRequest(url, request);
            
            long duration = System.currentTimeMillis() - startTime;
            System.out.println("=====================================================================");
            System.out.println("✅ [BACKEND] RECEIVED RESPONSE FROM ELECTIONGUARD");
            System.out.println("=====================================================================");
            System.out.println("⏱️ Response time: " + duration + "ms");
            System.out.println("📏 Response length: " + (response != null ? response.length() : 0) + " characters");
            System.out.println("=====================================================================");
            
            if (response == null) {
                System.err.println("❌ [BACKEND] ERROR: Received null response from ElectionGuard");
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            System.out.println("🔄 [BACKEND] Parsing response JSON...");
            ElectionGuardPartialDecryptionResponse parsedResponse = objectMapper.readValue(response, ElectionGuardPartialDecryptionResponse.class);
            System.out.println("✅ [BACKEND] Successfully parsed response");
            System.out.println("   - Tally share present: " + (parsedResponse.tally_share() != null));
            System.out.println("   - Ballot shares present: " + (parsedResponse.ballot_shares() != null));
            System.out.println("=====================================================================");
            
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
            // 1. Check if combine already exists or is in progress
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            if (electionCenters == null || electionCenters.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("No election centers found. Please create tally first.")
                    .build();
            }
            
            long completedChunks = electionCenterRepository.countByElectionIdAndElectionResultNotNull(electionId);
            
            if (completedChunks > 0 && completedChunks < electionCenters.size()) {
                System.out.println("⚠️ Combine already in progress for election " + electionId);
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Combine is already in progress")
                    .build();
            }
            
            if (completedChunks == electionCenters.size()) {
                System.out.println("✅ Combine already completed for election " + electionId);
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Combine already completed for this election")
                    .build();
            }
            
            // 2. Try to acquire lock
            Boolean lockAcquired = combineLocks.putIfAbsent(electionId, true);
            if (lockAcquired != null) {
                System.out.println("⚠️ Another combine process is already running for this election");
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Combine is already in progress")
                    .build();
            }
            
            try {
                System.out.println("✅ Starting async processing...");
                
                // 3. Start async processing
                processCombineAsync(electionId);
                
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Combine process initiated. Processing in progress...")
                    .build();
                    
            } catch (Exception e) {
                // Release lock on error
                combineLocks.remove(electionId);
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
    @Async
    public void processCombineAsync(Long electionId) {
        try {
            System.out.println("=== ASYNC COMBINE STARTED ===");
            System.out.println("Election ID: " + electionId);
            
            // Get election center IDs (not full objects - memory efficient)
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(electionId);
            int totalChunks = electionCenterIds != null ? electionCenterIds.size() : 0;
            
            if (totalChunks == 0) {
                System.err.println("❌ No election centers found");
                return;
            }
            
            // ✅ NEW: Queue combine tasks instead of processing in loop
            System.out.println("=== QUEUEING COMBINE DECRYPTION TASKS ===");
            decryptionTaskQueueService.queueCombineDecryptionTasks(electionId, electionCenterIds);
            
            System.out.println("✅ All combine tasks queued (" + totalChunks + " chunks)");
            System.out.println("Workers will process chunks one at a time, releasing memory after each chunk");
            
            /* OLD CODE - Replaced with RabbitMQ queue-based processing
            // Call the existing combine method
            CombinePartialDecryptionRequest request = new CombinePartialDecryptionRequest(electionId);
            CombinePartialDecryptionResponse response = combinePartialDecryption(request);
            
            if (response.success()) {
                // Mark as completed with correct processed chunks count
                System.out.println("🎉 COMBINE PROCESS COMPLETED SUCCESSFULLY - Processed " + totalChunks + " chunks");
            } else {
                System.err.println("❌ COMBINE PROCESS FAILED: " + response.message());
            }
            */
            
        } catch (Exception e) {
            System.err.println("❌ Error in async combine: " + e.getMessage());
            System.err.println("Stack trace: " + e);
        } finally {
            // Release lock
            combineLocks.remove(electionId);
            System.out.println("🔓 Lock released for election " + electionId);
        }
    }

    // Removed: updateCombineStatus - no longer needed as we query database directly

    /**
     * Get current combine status for an election
     * Queries RoundRobinTaskScheduler for real-time chunk processing state
     */
    public CombineStatusResponse getCombineStatus(Long electionId) {
        // Try to get progress from scheduler first (live task tracking)
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> electionProgress = 
            decryptionTaskQueueService.getRoundRobinTaskScheduler().getElectionProgress(electionId);
        
        // Filter for combine decryption tasks
        List<com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress> combineTasks = electionProgress.stream()
            .filter(p -> p.getTaskType() == com.amarvote.amarvote.model.scheduler.TaskType.COMBINE_DECRYPTION)
            .collect(Collectors.toList());
        
        if (!combineTasks.isEmpty()) {
            // Active task found in scheduler - return live progress
            com.amarvote.amarvote.model.scheduler.TaskInstance.TaskProgress progress = combineTasks.get(0);
            
            String status;
            if (progress.getCompletedChunks() == 0 && progress.getProcessingChunks() == 0 && progress.getQueuedChunks() == 0) {
                status = "pending";
            } else if (progress.isComplete()) {
                status = "completed";
            } else {
                status = "in_progress";
            }
            
            return CombineStatusResponse.builder()
                .success(true)
                .status(status)
                .message("Combine status retrieved successfully")
                .totalChunks((int) progress.getTotalChunks())
                .processedChunks((int) progress.getCompletedChunks())
                .progressPercentage(progress.getCompletionPercentage())
                .build();
        }
        
        // No active task in scheduler - check database for completed combination
        List<ElectionCenter> allChunks = electionCenterRepository.findByElectionId(electionId);
        int totalChunks = allChunks.size();
        
        if (totalChunks == 0) {
            return CombineStatusResponse.builder()
                .success(true)
                .status("not_started")
                .message("No tally chunks found for this election")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .build();
        }
        
        // Count how many chunks have electionResult filled (combination completed)
        long processedChunks = electionCenterRepository.countByElectionIdAndElectionResultNotNull(electionId);
        
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
        
        return CombineStatusResponse.builder()
            .success(true)
            .status(status)
            .message("Combine status retrieved successfully")
            .totalChunks(totalChunks)
            .processedChunks((int) processedChunks)
            .progressPercentage(progressPercentage)
            .build();
    }

    /**
     * NOTE: @Transactional removed to prevent Hibernate session memory leak.
     * Each chunk is processed in its own transaction via processCombineChunkTransactional().
     */
    public CombinePartialDecryptionResponse combinePartialDecryption(CombinePartialDecryptionRequest request) {
        try {
            System.out.println("=== COMBINE PARTIAL DECRYPTION STARTED (Memory-Efficient Mode) ===");
            
            // 🔥 LOG: Combine decryption start
            com.amarvote.amarvote.model.TaskLog combineTaskLog = taskLogService.logTaskStart(
                request.election_id(),
                "COMBINE_DECRYPTION",
                "Combining partial decryption shares to compute election results",
                "system" // TODO: Pass user email from request if available
            );
            System.out.println("📝 Task log created: ID=" + combineTaskLog.getLogId() + " | Task: Combine Decryption");
            
            // 1. Fetch election
            Optional<Election> electionOpt = electionRepository.findById(request.election_id());
            if (!electionOpt.isPresent()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            Election election = electionOpt.get();

            // 2. MEMORY-EFFICIENT: Check if tally exists using IDs first
            List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(request.election_id());
            if (electionCenterIds == null || electionCenterIds.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election tally has not been created yet. Please create the tally first.")
                    .build();
            }
            
            System.out.println("✅ Found " + electionCenterIds.size() + " election center IDs");

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
                System.out.println("✅ Results already computed for all chunks. Returning cached results.");
                
                // Fetch all centers to build aggregated results
                List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
                Object cachedResults = buildAggregatedResultsFromChunks(electionCenters);
                
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Election results retrieved from cache")
                    .results(cachedResults)
                    .build();
            }
            
            System.out.println("🔄 Computing fresh results for " + electionCenterIds.size() + " chunk(s)");

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

            System.out.println(String.format("✅ Quorum met: %d/%d guardians have submitted keys (quorum: %d)", 
                    availableGuardians.size(), guardians.size(), quorum));

            // Log available and missing guardian details
            List<Integer> availableSequences = availableGuardians.stream()
                .map(Guardian::getSequenceOrder)
                .collect(Collectors.toList());
            System.out.println("Available guardian sequences: " + availableSequences);

            // 7. ✅ PROCESS EACH CHUNK SEPARATELY (MEMORY-EFFICIENT)
            // Loop through each election_center ID and combine decryption shares for that chunk
            int processedChunkCount = 0;
            for (Long electionCenterId : electionCenterIds) {
                processedChunkCount++;
                System.out.println("=== PROCESSING CHUNK " + processedChunkCount + "/" + electionCenterIds.size() 
                    + " (election_center_id: " + electionCenterId + ") ===");
                System.out.println("Fetching election center from database...");
                
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
                System.out.println("Found " + chunkSubmittedBallots.size() + " ballots for chunk " + electionCenter.getElectionCenterId());

                
                List<String> ballotCipherTexts = chunkSubmittedBallots.stream()
                    .map(SubmittedBallot::getCipherText)
                    .collect(Collectors.toList());
                
                // Get decryptions for THIS CHUNK
                List<Decryption> decryptions = decryptionRepository.findByElectionCenterId(electionCenter.getElectionCenterId());
            
                System.out.println("Found " + decryptions.size() + " decryption records for election center " + electionCenter.getElectionCenterId());
                
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
                    System.out.println("\n" + "*".repeat(80));
                    System.out.println("🔍 BUILDING COMPENSATED ARRAYS FOR CHUNK " + electionCenter.getElectionCenterId());
                    System.out.println("*".repeat(80));
                    System.out.println("Missing guardians count: " + missingGuardians.size());
                    
                    // Sort missing guardians by sequence_order for consistent ordering
                    missingGuardians.sort((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()));
                    
                    System.out.print("Missing guardian sequences (sorted): [");
                    for (int i = 0; i < missingGuardians.size(); i++) {
                        System.out.print(missingGuardians.get(i).getSequenceOrder());
                        if (i < missingGuardians.size() - 1) System.out.print(", ");
                    }
                    System.out.println("]");
                    
                    System.out.print("Available guardian sequences (sorted): [");
                    List<Guardian> sortedAvailableForDisplay = availableGuardians.stream()
                        .sorted((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()))
                        .collect(Collectors.toList());
                    for (int i = 0; i < sortedAvailableForDisplay.size(); i++) {
                        System.out.print(sortedAvailableForDisplay.get(i).getSequenceOrder());
                        if (i < sortedAvailableForDisplay.size() - 1) System.out.print(", ");
                    }
                    System.out.println("]");
                    System.out.println("-".repeat(80));
                    
                    for (Guardian missingGuardian : missingGuardians) {
                        System.out.println("\n📋 Processing missing Guardian " + missingGuardian.getSequenceOrder() + " (ID: " + missingGuardian.getGuardianId() + ")");
                        
                        // Get all compensated decryptions for this missing guardian in this chunk
                        List<CompensatedDecryption> compensatedDecryptions = compensatedDecryptionRepository
                            .findByElectionCenterIdAndMissingGuardianId(
                                electionCenter.getElectionCenterId(),
                                missingGuardian.getGuardianId()
                            );
                        
                        System.out.println("  Found " + compensatedDecryptions.size() + " compensated decryption(s) in database");
                        
                        if (!compensatedDecryptions.isEmpty()) {
                            System.out.println("  Compensating guardian IDs in database: " + 
                                compensatedDecryptions.stream()
                                    .map(cd -> cd.getCompensatingGuardianId().toString())
                                    .collect(Collectors.joining(", ")));
                            // Create a map of compensating guardian ID -> CompensatedDecryption for sorting
                            Map<Long, CompensatedDecryption> cdMap = new HashMap<>();
                            for (CompensatedDecryption cd : compensatedDecryptions) {
                                cdMap.put(cd.getCompensatingGuardianId(), cd);
                            }
                            
                            // Sort available guardians by sequence_order to ensure consistent ordering
                            List<Guardian> sortedAvailableGuardians = availableGuardians.stream()
                                .sorted((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()))
                                .collect(Collectors.toList());
                            
                            System.out.println("  Sorted available guardians for array building: " + 
                                sortedAvailableGuardians.stream()
                                    .map(g -> g.getSequenceOrder().toString())
                                    .collect(Collectors.joining(", ")));
                            
                            System.out.println("  ⚙️ Adding shares to arrays in sequence order:");
                            
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
                                    
                                    System.out.println("    [" + currentIndex + "] missing=" + missingGuardian.getSequenceOrder() + 
                                                     ", compensating=" + compensatingGuardian.getSequenceOrder());
                                    System.out.println("        Current missing_guardian_ids: " + missingGuardianIds);
                                    System.out.println("        Current compensating_guardian_ids: " + compensatingGuardianIds);
                                } else {
                                    System.out.println("    ⚠️ No compensated share found from Guardian " + compensatingGuardian.getSequenceOrder() + 
                                                     " for missing Guardian " + missingGuardian.getSequenceOrder());
                                }
                            }
                            System.out.println("  ✅ Added " + addedForThisGuardian + " share(s) for missing Guardian " + missingGuardian.getSequenceOrder());
                        } else {
                            System.out.println("⚠️ No compensated decryptions found for missing guardian " + missingGuardian.getSequenceOrder() + 
                                             " in chunk " + electionCenter.getElectionCenterId());
                        }
                    }
                    
                    // Log the final arrays for verification
                    System.out.println("\n" + "*".repeat(80));
                    System.out.println("📊 FINAL COMPENSATED ARRAYS SUMMARY");
                    System.out.println("*".repeat(80));
                    System.out.println("missing_guardian_ids:       " + missingGuardianIds);
                    System.out.println("compensating_guardian_ids:  " + compensatingGuardianIds);
                    System.out.println("\nArray lengths:");
                    System.out.println("  - missing_guardian_ids:        " + missingGuardianIds.size());
                    System.out.println("  - compensating_guardian_ids:   " + compensatingGuardianIds.size());
                    System.out.println("  - compensated_tally_shares:    " + compensatedTallyShares.size());
                    System.out.println("  - compensated_ballot_shares:   " + compensatedBallotShares.size());
                    
                    System.out.println("\n✅ Expected pattern verified:");
                    System.out.println("   For each missing guardian, all available guardians provide shares");
                    System.out.println("   Missing guardians: " + missingGuardians.size());
                    System.out.println("   Available guardians: " + availableGuardians.size());
                    System.out.println("   Expected total shares: " + (missingGuardians.size() * availableGuardians.size()));
                    System.out.println("   Actual shares: " + missingGuardianIds.size());
                    
                    if (missingGuardianIds.size() == missingGuardians.size() * availableGuardians.size()) {
                        System.out.println("   ✅ CORRECT: All compensated shares present!");
                    } else {
                        System.out.println("   ⚠️ WARNING: Missing some compensated shares!");
                    }
                    System.out.println("*".repeat(80) + "\n");
                }

                // Get encrypted tally from THIS chunk's ElectionCenter
                String ciphertextTallyString = electionCenter.getEncryptedTally();
                if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Encrypted tally not found in election center " + electionCenter.getElectionCenterId())
                        .build();
                }
                
                ElectionGuardCombineDecryptionSharesRequest guardRequest = ElectionGuardCombineDecryptionSharesRequest.builder()
                    .party_names(partyNames)
                    .candidate_names(candidateNames)
                    .joint_public_key(election.getJointPublicKey())
                    .commitment_hash(election.getBaseHash())
                    .ciphertext_tally(ciphertextTallyString)
                    .submitted_ballots(ballotCipherTexts)
                    .guardian_data(guardianDataList)
                    .available_guardian_ids(availableGuardianIds)
                    .available_guardian_public_keys(availableGuardianPublicKeys)
                    .available_tally_shares(availableTallyShares)
                    .available_ballot_shares(availableBallotShares)
                    .missing_guardian_ids(missingGuardianIds)
                    .compensating_guardian_ids(compensatingGuardianIds)
                    .compensated_tally_shares(compensatedTallyShares)
                    .compensated_ballot_shares(compensatedBallotShares)
                    .quorum(quorum)
                    .number_of_guardians(guardians.size())
                    .build();

                ElectionGuardCombineDecryptionSharesResponse guardResponse = callElectionGuardCombineDecryptionSharesService(guardRequest);

                // Process the response string to extract results and save to election_result
                if ("success".equals(guardResponse.status())) {
                    // Save chunk result to THIS chunk's election_result
                    electionCenter.setElectionResult(guardResponse.results());
                    electionCenterRepository.save(electionCenter);
                    System.out.println("💾 Saved chunk results to election_center_id: " + electionCenter.getElectionCenterId());
                } else {
                    System.err.println("❌ ElectionGuard combine decryption failed for chunk " + electionCenter.getElectionCenterId() + ": " + guardResponse.status());
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Failed to combine partial decryption for chunk " + electionCenter.getElectionCenterId() + ": " + guardResponse.status())
                        .build();
                }
                
                System.out.println("✅ Chunk " + processedChunkCount + "/" + electionCenterIds.size() + " processed successfully");
                
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
                    System.out.println("🗑️ [COMBINE-DECRYPT-GC] After chunk " + processedChunkCount + "/" + electionCenterIds.size() + ": " + usedMB + " MB");
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
            
            System.out.println("✅ Successfully combined partial decryptions for election: " + request.election_id());
            System.out.println("✅ Updated election status to 'decrypted'");
            System.out.println("✅ Election results are now available for viewing");
            
            // 🔥 LOG: Combine decryption complete
            taskLogService.logTaskComplete(combineTaskLog);
            System.out.println("📝 Task log completed: ID=" + combineTaskLog.getLogId() + 
                " | Duration: " + combineTaskLog.getDurationMs() + "ms");
            
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
            System.out.println("Updating election choices with vote results for election: " + electionId);
            
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
                            System.out.println("Updated votes for candidate '" + candidateName + "': " + voteCount);
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
            System.out.println("Successfully updated " + electionChoices.size() + " election choices with vote counts");
            
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
            System.out.println("\n" + "=".repeat(80));
            System.out.println("🔐 STARTING COMPENSATED DECRYPTION SHARE CREATION (Memory-Efficient Mode)");
            System.out.println("=".repeat(80));
            System.out.println("Election ID: " + election.getElectionId());
            System.out.println("Creating guardian: Guardian " + availableGuardian.getSequenceOrder() + " (ID: " + availableGuardian.getGuardianId() + ")");
            System.out.println("Number of chunks to process: " + electionCenterIds.size());
            System.out.println("=".repeat(80));
            
            // Get all guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(election.getElectionId());
            System.out.println("\n📊 Total guardians in election: " + allGuardians.size());
            
            // Get ALL other guardians (excluding the current guardian who is creating compensated shares)
            List<Guardian> otherGuardians = allGuardians.stream()
                .filter(g -> !g.getSequenceOrder().equals(availableGuardian.getSequenceOrder()))
                .collect(Collectors.toList());
            
            System.out.println("Other guardians (excluding Guardian " + availableGuardian.getSequenceOrder() + "): " + otherGuardians.size());
            if (!otherGuardians.isEmpty()) {
                System.out.print("Other guardian sequences: [");
                for (int i = 0; i < otherGuardians.size(); i++) {
                    System.out.print(otherGuardians.get(i).getSequenceOrder());
                    if (i < otherGuardians.size() - 1) System.out.print(", ");
                }
                System.out.println("]");
            }
            
            // Create compensated shares for ALL other guardians for EACH chunk
            if (otherGuardians.isEmpty()) {
                System.out.println("⚠️ No other guardians found, skipping compensated decryption");
                return;
            }
            
            System.out.println("\n" + "-".repeat(80));
            System.out.println("📦 PROCESSING COMPENSATED DECRYPTION (Guardian-First Approach)");
            System.out.println("-".repeat(80));
            
            String userEmail = availableGuardian.getUserEmail(); // Get user email for logging
            
            // 🔥 Process guardian-by-guardian for better logging
            for (Guardian otherGuardian : otherGuardians) {
                // 🔥 LOG: Compensated decryption start for this guardian pair
                com.amarvote.amarvote.model.TaskLog compensatedTaskLog = taskLogService.logTaskStart(
                    election.getElectionId(),
                    "COMPENSATED_DECRYPTION",
                    "Guardian " + availableGuardian.getSequenceOrder() + " creating compensated shares for Guardian " + otherGuardian.getSequenceOrder(),
                    userEmail
                );
                // Store guardian IDs in the task log for reference
                compensatedTaskLog.setCompensatingGuardianId(availableGuardian.getGuardianId());
                compensatedTaskLog.setMissingGuardianId(otherGuardian.getGuardianId());
                compensatedTaskLog = taskLogService.logTaskComplete(compensatedTaskLog); // Update immediately to store guardian IDs
                compensatedTaskLog.setStatus("STARTED"); // Reset to STARTED
                compensatedTaskLog.setEndTime(null);
                compensatedTaskLog.setDurationMs(null);
                
                System.out.println("\n📝 Task log created: ID=" + compensatedTaskLog.getLogId() + 
                    " | Task: Guardian " + availableGuardian.getSequenceOrder() + 
                    " compensating for Guardian " + otherGuardian.getSequenceOrder());
                
                int createdCount = 0;
                int skippedCount = 0;
                
                try {
                    // Process each chunk for this guardian pair
                    for (int chunkIndex = 0; chunkIndex < electionCenterIds.size(); chunkIndex++) {
                        Long electionCenterId = electionCenterIds.get(chunkIndex);
                        
                        // MEMORY-EFFICIENT: Fetch only the election center needed for this iteration
                        Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
                        if (!electionCenterOpt.isPresent()) {
                            System.err.println("❌ Election center not found: " + electionCenterId);
                            continue;
                        }
                        ElectionCenter electionCenter = electionCenterOpt.get();
                        
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
                        } else {
                            skippedCount++;
                        }
                        
                        // Clear reference
                        electionCenter = null;
                    }
                    
                    // 🔥 LOG: Compensated decryption complete for this guardian pair
                    taskLogService.logTaskComplete(compensatedTaskLog);
                    System.out.println("✅ Task log completed: ID=" + compensatedTaskLog.getLogId() + 
                        " | Guardian " + availableGuardian.getSequenceOrder() + " → Guardian " + otherGuardian.getSequenceOrder() +
                        " | Duration: " + compensatedTaskLog.getDurationMs() + "ms | Created: " + createdCount + ", Skipped: " + skippedCount);
                        
                } catch (Exception e) {
                    // 🔥 LOG: Compensated decryption failure for this guardian pair
                    taskLogService.logTaskFailure(compensatedTaskLog, e.getMessage());
                    System.err.println("❌ Task log failed: ID=" + compensatedTaskLog.getLogId() + 
                        " | Guardian " + availableGuardian.getSequenceOrder() + " → Guardian " + otherGuardian.getSequenceOrder() +
                        " | Error: " + e.getMessage());
                }
            }
            
            System.out.println("\n" + "=".repeat(80));
            System.out.println("✅ COMPLETED COMPENSATED DECRYPTION SHARES CREATION");
            System.out.println("Guardian " + availableGuardian.getSequenceOrder() + " has finished creating shares across all " + electionCenterIds.size() + " chunks");
            System.out.println("=".repeat(80) + "\n");
            
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
            System.out.println("Creating compensated share for chunk " + electionCenter.getElectionCenterId() + ": compensating=" + compensatingGuardian.getSequenceOrder() + 
                             ", other=" + otherGuardian.getSequenceOrder());
            
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
                System.out.println("Compensated share already exists for this chunk, skipping");
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
            
            ElectionGuardCompensatedDecryptionRequest request = ElectionGuardCompensatedDecryptionRequest.builder()
                .available_guardian_id(String.valueOf(compensatingGuardian.getSequenceOrder()))
                .missing_guardian_id(String.valueOf(otherGuardian.getSequenceOrder()))
                .available_guardian_data(availableGuardianDataJson)
                .missing_guardian_data(missingGuardianDataJson)
                .available_private_key(compensatingGuardianPrivateKey)
                .available_public_key(compensatingGuardian.getGuardianPublicKey())
                .available_polynomial(compensatingGuardianPolynomial)
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .ciphertext_tally(electionCenter.getEncryptedTally()) // Use chunk's encrypted tally
                .submitted_ballots(ballotCipherTexts) // Use chunk's ballots
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
            compensatedDecryption.setCompensatedTallyShare(response.compensated_tally_share());
            compensatedDecryption.setCompensatedBallotShare(response.compensated_ballot_shares());
            
            compensatedDecryptionRepository.save(compensatedDecryption);
            
            System.out.println("Successfully saved compensated decryption share for chunk " + electionCenter.getElectionCenterId());
            
            // ✅ AGGRESSIVE MEMORY CLEANUP
            entityManager.flush();
            entityManager.clear();
            
            // Null out large objects
            electionChoices = null;
            candidateNames = null;
            partyNames = null;
            submittedBallots.clear();
            submittedBallots = null;
            ballotCipherTexts.clear();
            ballotCipherTexts = null;
            request = null;
            response = null;
            compensatedDecryption = null;
            
            // Suggest garbage collection
            System.gc();
            
            System.out.println("🗑️ Memory cleanup: EntityManager cleared for compensated share");
            
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
            
            System.out.println("Calling ElectionGuard compensated decryption service at: " + url);
            
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
            
            System.out.println("=== CALLING ELECTIONGUARD COMBINE DECRYPTION SHARES ===");
            System.out.println("URL: " + url);
            System.out.println("Party names count: " + (request.party_names() != null ? request.party_names().size() : 0));
            System.out.println("Candidate names count: " + (request.candidate_names() != null ? request.candidate_names().size() : 0));
            System.out.println("Guardian data count: " + (request.guardian_data() != null ? request.guardian_data().size() : 0));
            System.out.println("Available guardian IDs: " + request.available_guardian_ids());
            System.out.println("Available guardian public keys count: " + (request.available_guardian_public_keys() != null ? request.available_guardian_public_keys().size() : 0));
            System.out.println("Available tally shares count: " + (request.available_tally_shares() != null ? request.available_tally_shares().size() : 0));
            System.out.println("Available ballot shares count: " + (request.available_ballot_shares() != null ? request.available_ballot_shares().size() : 0));
            System.out.println("Submitted ballots count: " + (request.submitted_ballots() != null ? request.submitted_ballots().size() : 0));
            System.out.println("Quorum: " + request.quorum());
            System.out.println("Number of guardians: " + request.number_of_guardians());
            System.out.println("Has ciphertext_tally: " + (request.ciphertext_tally() != null && !request.ciphertext_tally().trim().isEmpty()));
            
            String response = electionGuardService.postRequest(url, request);
            
            System.out.println("Received response from ElectionGuard service: " + response);

            
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
     * 
     * CRITICAL FIX: Only return results if ALL chunks are complete.
     * This prevents showing partial results when combine decryption is still in progress.
     */
    public Object getElectionResults(Long electionId) {
        try {
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            
            if (electionCenters == null || electionCenters.isEmpty()) {
                System.out.println("No election centers found for election: " + electionId);
                return null;
            }
            
            int totalChunks = electionCenters.size();
            
            // CRITICAL FIX: Check if ALL chunks have results (not just any chunk)
            // This prevents showing incomplete results during ongoing combine decryption
            long completedChunks = electionCenterRepository.countByElectionIdAndElectionResultNotNull(electionId);
            
            if (completedChunks == 0) {
                System.out.println("No results computed yet for election: " + electionId);
                return null;
            }
            
            // CRITICAL: Only return results if ALL chunks are complete
            if (completedChunks < totalChunks) {
                System.out.println("⚠️ Partial results detected: " + completedChunks + "/" + totalChunks + " chunks complete. "
                    + "NOT returning results until all chunks are processed to prevent showing incomplete data.");
                return null;
            }
            
            System.out.println("✅ All " + totalChunks + " chunks complete. Returning final aggregated results.");
            
            // Build and return aggregated results (only when complete)
            return buildAggregatedResultsFromChunks(electionCenters);
            
        } catch (Exception e) {
            System.err.println("Error getting election results: " + e.getMessage());
            // Stack trace available in exception: e
            return null;
        }
    }

    /**
     * Parses the results string from the microservice response
     */

    /**
     * Builds aggregated results from all chunk election_result data
     * Combines per-chunk results into a single comprehensive result object
     */
    private Object buildAggregatedResultsFromChunks(List<ElectionCenter> electionCenters) {
        try {
            Map<String, Object> aggregatedResult = new HashMap<>();
            List<Map<String, Object>> chunkResults = new ArrayList<>();
            Map<String, Integer> finalTallies = new HashMap<>();
            List<Map<String, Object>> allBallots = new ArrayList<>();
            
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
                                // Add chunk index to each ballot
                                for (Map<String, Object> ballot : ballots) {
                                    ballot.put("chunkIndex", i + 1);
                                    allBallots.add(ballot);
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
            aggregatedResult.put("allBallots", allBallots);
            aggregatedResult.put("total_ballots_cast", allBallots.size());
            aggregatedResult.put("total_valid_ballots", allBallots.size());
            
            System.out.println("✅ Built aggregated results from " + chunkResults.size() + " chunks with " + allBallots.size() + " total ballots");
            System.out.println("✅ Final tallies: " + finalTallies);
            return aggregatedResult;
            
        } catch (Exception e) {
            System.err.println("Error building aggregated results: " + e.getMessage());
            // Stack trace available in exception: e
            return new HashMap<>();
        }
    }
}
