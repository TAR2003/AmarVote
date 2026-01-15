package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
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
import com.amarvote.amarvote.dto.TallyCreationStatusResponse;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.model.TallyCreationStatus;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.repository.TallyCreationStatusRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TallyService {
    
    // Concurrent map to track which elections are currently processing tally creation
    private static final ConcurrentHashMap<Long, Boolean> tallyCreationLocks = new ConcurrentHashMap<>();

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
    private TallyCreationStatusRepository tallyCreationStatusRepository;
    
    @Autowired
    private ChunkingService chunkingService;
    
    @Autowired
    private ElectionGuardService electionGuardService;
    
    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Get the current tally creation status for an election
     */
    public TallyCreationStatusResponse getTallyStatus(Long electionId) {
        Optional<TallyCreationStatus> statusOpt = tallyCreationStatusRepository.findByElectionId(electionId);
        
        if (statusOpt.isEmpty()) {
            // Check if tally already exists (old elections that completed before this feature)
            List<ElectionCenter> existingChunks = electionCenterRepository.findByElectionId(electionId);
            if (!existingChunks.isEmpty()) {
                return TallyCreationStatusResponse.builder()
                    .success(true)
                    .status("completed")
                    .message("Tally already exists")
                    .totalChunks(existingChunks.size())
                    .processedChunks(existingChunks.size())
                    .progressPercentage(100.0)
                    .build();
            }
            
            return TallyCreationStatusResponse.builder()
                .success(true)
                .status("not_started")
                .message("Tally creation has not been initiated")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .build();
        }
        
        TallyCreationStatus status = statusOpt.get();
        double progressPercentage = status.getTotalChunks() > 0 
            ? (status.getProcessedChunks() * 100.0) / status.getTotalChunks()
            : 0.0;
        
        return TallyCreationStatusResponse.builder()
            .success(true)
            .status(status.getStatus())
            .message("Tally creation status retrieved successfully")
            .totalChunks(status.getTotalChunks())
            .processedChunks(status.getProcessedChunks())
            .createdBy(status.getCreatedBy())
            .startedAt(status.getStartedAt() != null ? status.getStartedAt().toString() : null)
            .completedAt(status.getCompletedAt() != null ? status.getCompletedAt().toString() : null)
            .errorMessage(status.getErrorMessage())
            .progressPercentage(progressPercentage)
            .build();
    }

    /**
     * Initiate tally creation (returns immediately, processes asynchronously)
     */
    public CreateTallyResponse initiateTallyCreation(CreateTallyRequest request, String userEmail) {
        try {
            System.out.println("=== Initiating Tally Creation ===");
            System.out.println("Election ID: " + request.getElection_id() + ", User: " + userEmail);
            
            // Check if tally already exists or is being created
            Optional<TallyCreationStatus> existingStatus = tallyCreationStatusRepository.findByElectionId(request.getElection_id());
            
            if (existingStatus.isPresent()) {
                TallyCreationStatus status = existingStatus.get();
                
                if ("in_progress".equals(status.getStatus())) {
                    System.out.println("⚠️ Tally creation already in progress");
                    
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Tally creation is already in progress")
                        .encryptedTally("IN_PROGRESS:" + status.getProcessedChunks() + "/" + status.getTotalChunks())
                        .build();
                }
                
                if ("completed".equals(status.getStatus())) {
                    System.out.println("✅ Tally already exists");
                    return CreateTallyResponse.builder()
                        .success(true)
                        .message("Tally already exists")
                        .encryptedTally("COMPLETED")
                        .build();
                }
            }
            
            // Also check if chunks exist (for backwards compatibility)
            List<ElectionCenter> existingChunks = electionCenterRepository.findByElectionId(request.getElection_id());
            if (!existingChunks.isEmpty()) {
                System.out.println("✅ Tally already exists (found existing chunks)");
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Tally already exists")
                    .encryptedTally("COMPLETED")
                    .build();
            }
            
            // Verify election has ended
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
            
            // Create initial status record
            TallyCreationStatus status = TallyCreationStatus.builder()
                .electionId(request.getElection_id())
                .status("pending")
                .totalChunks(0)
                .processedChunks(0)
                .createdBy(userEmail)
                .startedAt(Instant.now())
                .build();
            tallyCreationStatusRepository.save(status);
            
            // Start async processing
            createTallyAsync(request, userEmail);
            
            return CreateTallyResponse.builder()
                .success(true)
                .message("Tally creation initiated successfully. Processing in background...")
                .encryptedTally("INITIATED")
                .build();
                
        } catch (Exception e) {
            System.err.println("❌ Error initiating tally creation: " + e.getMessage());
            e.printStackTrace();
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
        
        // Double-check locking to prevent concurrent processing
        if (tallyCreationLocks.putIfAbsent(electionId, true) != null) {
            System.out.println("⚠️ Tally creation already in progress for election: " + electionId);
            return;
        }
        
        try {
            updateTallyStatusTransactional(electionId, "in_progress", 0, 0, null);
            
            System.out.println("=== Async Tally Creation Started (Memory-Efficient Mode) ===");
            System.out.println("Election ID: " + electionId);
            
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
            
            // Update status with total chunks
            updateTallyStatusTransactional(electionId, "in_progress", chunkConfig.getNumChunks(), 0, null);
            
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
            
            int numberOfGuardians = guardianRepository.findByElectionId(election.getElectionId()).size();
            
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
                updateTallyStatusTransactional(electionId, "in_progress", chunkConfig.getNumChunks(), processedChunks, null);
                System.out.println("✅ Chunk " + chunkNumber + " completed. Progress: " + processedChunks + "/" + chunkConfig.getNumChunks());
                
                // GARBAGE COLLECTION: Force GC every 10 chunks to prevent memory buildup
                if (processedChunks % 10 == 0) {
                    Runtime runtime = Runtime.getRuntime();
                    long beforeGC = runtime.totalMemory() - runtime.freeMemory();
                    System.gc();
                    System.out.println("🗑️ [GC] Forced garbage collection at tally chunk " + processedChunks);
                    try { Thread.sleep(100); } catch (InterruptedException ie) {}
                    long afterGC = runtime.totalMemory() - runtime.freeMemory();
                    long freedMemory = beforeGC - afterGC;
                    System.out.println("💾 [Memory] Before GC: " + (beforeGC / 1024 / 1024) + " MB, After GC: " + (afterGC / 1024 / 1024) + " MB, Freed: " + (freedMemory / 1024 / 1024) + " MB");
                }
            }
            
            // Update election status in separate transaction
            updateElectionStatusTransactional(electionId, "completed");
            updateTallyStatusTransactional(electionId, "completed", chunkConfig.getNumChunks(), processedChunks, null);
            
            System.out.println("=== Tally Creation Completed Successfully ===");
            
        } catch (Exception e) {
            System.err.println("❌ Error in async tally creation: " + e.getMessage());
            e.printStackTrace();
            updateTallyStatusTransactional(electionId, "failed", 0, 0, e.getMessage());
        } finally {
            // Release lock
            tallyCreationLocks.remove(electionId);
        }
    }

    /**
     * Process one tally chunk in isolated transaction
     * Transaction boundary ensures all entities are released after chunk completion
     */
    @Transactional
    private void processTallyChunkTransactional(
            Long electionId,
            int chunkNumber,
            List<Long> chunkBallotIds,
            List<String> partyNames,
            List<String> candidateNames,
            String jointPublicKey,
            String baseHash,
            int quorum,
            int numberOfGuardians) {
        
        System.out.println("=== Processing Chunk " + chunkNumber + " (Transaction Start) ===");
        System.out.println("Fetching " + chunkBallotIds.size() + " ballots from database for this chunk...");
        
        // Fetch only the ballots needed for this chunk
        List<Ballot> chunkBallots = ballotRepository.findByBallotIdIn(chunkBallotIds);
        
        // Create election center entry
        ElectionCenter electionCenter = ElectionCenter.builder()
            .electionId(electionId)
            .build();
        electionCenter = electionCenterRepository.save(electionCenter);
        
        // Extract cipher texts
        List<String> chunkEncryptedBallots = chunkBallots.stream()
            .map(Ballot::getCipherText)
            .collect(Collectors.toList());
        
        // Call ElectionGuard service (no transaction needed for external HTTP call)
        ElectionGuardTallyResponse guardResponse = callElectionGuardTallyService(
            partyNames, candidateNames, jointPublicKey, 
            baseHash, chunkEncryptedBallots,
            quorum, numberOfGuardians
        );
        
        if (!"success".equals(guardResponse.getStatus())) {
            throw new RuntimeException("ElectionGuard service failed for chunk " + chunkNumber);
        }
        
        // Store encrypted tally
        electionCenter.setEncryptedTally(guardResponse.getCiphertext_tally());
        electionCenterRepository.save(electionCenter);
        
        // Save submitted ballots
        if (guardResponse.getSubmitted_ballots() != null) {
            for (String submittedBallotCipherText : guardResponse.getSubmitted_ballots()) {
                if (!submittedBallotRepository.existsByElectionCenterIdAndCipherText(
                        electionCenter.getElectionCenterId(), submittedBallotCipherText)) {
                    SubmittedBallot submittedBallot = SubmittedBallot.builder()
                        .electionCenterId(electionCenter.getElectionCenterId())
                        .cipherText(submittedBallotCipherText)
                        .build();
                    submittedBallotRepository.save(submittedBallot);
                }
            }
        }
        
        System.out.println("✅ Chunk " + chunkNumber + " transaction complete - Hibernate session will close and release memory");
        // Transaction ends here, Hibernate session closes automatically, all entities released from memory
    }
    
    /**
     * Update tally creation status in separate transaction
     */
    @Transactional
    private void updateTallyStatusTransactional(Long electionId, String status, int totalChunks, int processedChunks, String errorMessage) {
        try {
            Optional<TallyCreationStatus> statusOpt = tallyCreationStatusRepository.findByElectionId(electionId);
            
            if (statusOpt.isPresent()) {
                TallyCreationStatus tallyStatus = statusOpt.get();
                tallyStatus.setStatus(status);
                tallyStatus.setTotalChunks(totalChunks);
                tallyStatus.setProcessedChunks(processedChunks);
                tallyStatus.setErrorMessage(errorMessage);
                
                if ("completed".equals(status) || "failed".equals(status)) {
                    tallyStatus.setCompletedAt(Instant.now());
                }
                
                tallyCreationStatusRepository.save(tallyStatus);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Failed to update tally status: " + e.getMessage());
        }
    }
    
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
        String ciphertextTallyJson = guardResponse.getCiphertext_tally();
        electionCenter.setEncryptedTally(ciphertextTallyJson);
        electionCenterRepository.save(electionCenter);
        System.out.println("✅ Encrypted tally saved for chunk " + chunkNumber);
        
        // Save submitted_ballots for this chunk (linked to election_center_id)
        if (guardResponse.getSubmitted_ballots() != null && guardResponse.getSubmitted_ballots().length > 0) {
            System.out.println("Processing " + guardResponse.getSubmitted_ballots().length + " submitted ballots for chunk " + chunkNumber);
            
            int savedCount = 0;
            for (String submittedBallotCipherText : guardResponse.getSubmitted_ballots()) {
                try {
                    if (!submittedBallotRepository.existsByElectionCenterIdAndCipherText(
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
        
        System.out.println("✅ Chunk " + chunkNumber + " transaction complete - Hibernate session will close and release memory");
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
            
            int numberOfGuardians = guardianRepository.findByElectionId(election.getElectionId()).size();
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
                
                // GARBAGE COLLECTION: Force GC every 10 chunks to prevent memory buildup
                if (processedSyncChunks % 10 == 0) {
                    Runtime runtime = Runtime.getRuntime();
                    long beforeGC = runtime.totalMemory() - runtime.freeMemory();
                    System.gc();
                    System.out.println("🗑️ [GC] Forced garbage collection at sync tally chunk " + processedSyncChunks);
                    try { Thread.sleep(100); } catch (InterruptedException ie) {}
                    long afterGC = runtime.totalMemory() - runtime.freeMemory();
                    long freedMemory = beforeGC - afterGC;
                    System.out.println("💾 [Memory] Before GC: " + (beforeGC / 1024 / 1024) + " MB, After GC: " + (afterGC / 1024 / 1024) + " MB, Freed: " + (freedMemory / 1024 / 1024) + " MB");
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
            e.printStackTrace();
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
            e.printStackTrace();
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }

    /**
     * Utility method to remove duplicate submitted ballots for an election
     * This can be called if duplicates are found in the database
     */
    @Transactional
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
                submittedBallotRepository.deleteAll(ballotsToDelete);
                System.out.println("Removed " + ballotsToDelete.size() + " duplicate submitted ballots for election: " + electionId);
            } else {
                System.out.println("No duplicate submitted ballots found for election: " + electionId);
            }
        } catch (Exception e) {
            System.err.println("Error removing duplicate submitted ballots for election " + electionId + ": " + e.getMessage());
            throw new RuntimeException("Failed to remove duplicate submitted ballots", e);
        }
    }
}
