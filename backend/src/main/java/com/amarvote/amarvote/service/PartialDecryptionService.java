package com.amarvote.amarvote.service;

import java.time.Instant;
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
import com.amarvote.amarvote.model.CombineStatus;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.DecryptionStatus;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.CombineStatusRepository;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionStatusRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PartialDecryptionService {

    private final GuardianRepository guardianRepository;
    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final DecryptionRepository decryptionRepository;
    private final CombineStatusRepository combineStatusRepository;
    private final DecryptionStatusRepository decryptionStatusRepository;
    private final ObjectMapper objectMapper;
    private final ElectionGuardCryptoService cryptoService;
    
    // Concurrent lock to prevent multiple decryption processes for same guardian
    private final ConcurrentHashMap<String, Boolean> decryptionLocks = new ConcurrentHashMap<>();
    
    // Concurrent lock to prevent multiple combine processes for same election
    private final ConcurrentHashMap<Long, Boolean> combineLocks = new ConcurrentHashMap<>();
    
    @Autowired
    private ElectionGuardService electionGuardService;

    @Transactional
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
                System.out.println("=== PROCESSING CHUNK " + (processedChunks + 1) + " (election_center_id: " + electionCenterId + ") ===");
                System.out.println("Fetching election center from database...");
                
                // MEMORY-EFFICIENT: Fetch only the election center needed for this iteration
                Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
                if (!electionCenterOpt.isPresent()) {
                    System.err.println("❌ Election center not found: " + electionCenterId);
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Chunk " + (processedChunks + 1) + " not found")
                        .build();
                }
                ElectionCenter electionCenter = electionCenterOpt.get();
                
                // Get encrypted tally for this chunk
                String ciphertextTallyString = electionCenter.getEncryptedTally();
                if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                    System.err.println("❌ No encrypted tally for chunk " + electionCenterId);
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Chunk " + (processedChunks + 1) + " has no encrypted tally")
                        .build();
                }
                
                // Get submitted ballots for this chunk
                List<SubmittedBallot> chunkBallots = submittedBallotRepository.findByElectionCenterId(electionCenterId);
                List<String> ballotCipherTexts = chunkBallots.stream()
                    .map(SubmittedBallot::getCipherText)
                    .toList();
                System.out.println("Found " + ballotCipherTexts.size() + " ballots for chunk " + electionCenterId);
                
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
                    .joint_public_key(election.getJointPublicKey())
                    .commitment_hash(election.getBaseHash())
                    .number_of_guardians(numberOfGuardians)
                    .quorum(election.getElectionQuorum())
                    .build();
                
                System.out.println("🚀 Calling ElectionGuard service for chunk " + electionCenterId);
                ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);
                System.out.println("Received response from ElectionGuard service for chunk " + electionCenterId);
                
                // Check if tally_share is null (invalid key)
                if (guardResponse.tally_share() == null) {
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("The credentials you provided were not right, please provide the right credential file")
                        .build();
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
                System.out.println("✅ Saved decryption data for chunk " + electionCenterId);
                
                processedChunks++;
                
                // MEMORY-EFFICIENT: Clear references to allow garbage collection
                chunkBallots = null;
                ballotCipherTexts = null;
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
            
            // 4. Check if decryption already exists or is in progress
            Optional<DecryptionStatus> existingStatus = decryptionStatusRepository
                .findByElectionIdAndGuardianId(request.election_id(), guardian.getGuardianId());
            
            if (existingStatus.isPresent()) {
                DecryptionStatus status = existingStatus.get();
                
                if ("in_progress".equals(status.getStatus())) {
                    System.out.println("⚠️ Decryption already in progress for guardian " + guardian.getGuardianId());
                    return CreatePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Decryption is already in progress")
                        .build();
                }
                
                if ("completed".equals(status.getStatus())) {
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
                // MEMORY-EFFICIENT: Fetch only election center IDs (not full objects)
                List<Long> electionCenterIds = electionCenterRepository.findElectionCenterIdsByElectionId(request.election_id());
                
                // 6. Create or update decryption status
                DecryptionStatus decryptionStatus = existingStatus.orElse(DecryptionStatus.builder()
                    .electionId(request.election_id())
                    .guardianId(guardian.getGuardianId())
                    .guardianEmail(userEmail)
                    .guardianName(guardian.getUserEmail())
                    .totalChunks(electionCenterIds.size())
                    .processedChunks(0)
                    .currentPhase("pending")
                    .currentChunkNumber(0)
                    .totalCompensatedGuardians(0)
                    .processedCompensatedGuardians(0)
                    .createdAt(Instant.now())
                    .build());
                
                decryptionStatus.setStatus("pending");
                decryptionStatus.setStartedAt(Instant.now());
                decryptionStatus.setTotalChunks(electionCenterIds.size());
                decryptionStatus.setProcessedChunks(0);
                decryptionStatus.setCurrentPhase("pending");
                decryptionStatus.setErrorMessage(null);
                decryptionStatus.setUpdatedAt(Instant.now());
                
                decryptionStatusRepository.save(decryptionStatus);
                
                System.out.println("✅ Decryption status created.");
                
                // 7. Validate credentials BEFORE starting async processing
                System.out.println("🔑 Validating guardian credentials...");
                try {
                    String guardianCredentials = guardian.getCredentials();
                    if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
                        decryptionLocks.remove(lockKey);
                        decryptionStatus.setStatus("failed");
                        decryptionStatus.setErrorMessage("Guardian credentials not found in database. Please contact administrator.");
                        decryptionStatusRepository.save(decryptionStatus);
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
                        decryptionStatus.setStatus("failed");
                        decryptionStatus.setErrorMessage("The credential file you provided is incorrect. Please upload the correct credentials.txt file that was sent to you via email.");
                        decryptionStatusRepository.save(decryptionStatus);
                        return CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("The credential file you provided is incorrect. Please upload the correct credentials.txt file that was sent to you via email.")
                            .build();
                    }
                    
                    System.out.println("✅ Credentials validated successfully");
                } catch (Exception validationError) {
                    System.err.println("❌ Credential validation failed: " + validationError.getMessage());
                    decryptionLocks.remove(lockKey);
                    decryptionStatus.setStatus("failed");
                    decryptionStatus.setErrorMessage("Invalid credential file. Please ensure you uploaded the correct credentials.txt file sent to you via email.");
                    decryptionStatusRepository.save(decryptionStatus);
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
            e.printStackTrace();
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
     */
    public DecryptionStatusResponse getDecryptionStatus(Long electionId, Long guardianId) {
        Optional<DecryptionStatus> statusOpt = decryptionStatusRepository.findByElectionIdAndGuardianId(electionId, guardianId);
        
        if (statusOpt.isEmpty()) {
            // Check if decryption already completed (old way, before this feature)
            List<Decryption> existingDecryptions = decryptionRepository.findByGuardianId(guardianId);
            if (!existingDecryptions.isEmpty()) {
                return DecryptionStatusResponse.builder()
                    .success(true)
                    .status("completed")
                    .message("Decryption already exists")
                    .totalChunks(existingDecryptions.size())
                    .processedChunks(existingDecryptions.size())
                    .progressPercentage(100.0)
                    .build();
            }
            
            return DecryptionStatusResponse.builder()
                .success(true)
                .status("not_started")
                .message("Decryption has not been initiated")
                .totalChunks(0)
                .processedChunks(0)
                .progressPercentage(0.0)
                .build();
        }
        
        DecryptionStatus status = statusOpt.get();
        double progressPercentage = status.getTotalChunks() > 0 
            ? (status.getProcessedChunks() * 100.0) / status.getTotalChunks()
            : 0.0;
        
        double compensatedProgressPercentage = status.getTotalCompensatedGuardians() != null && status.getTotalCompensatedGuardians() > 0
            ? (status.getProcessedCompensatedGuardians() * 100.0) / status.getTotalCompensatedGuardians()
            : 0.0;
        
        return DecryptionStatusResponse.builder()
            .success(true)
            .status(status.getStatus())
            .message("Decryption status retrieved successfully")
            .totalChunks(status.getTotalChunks())
            .processedChunks(status.getProcessedChunks())
            .progressPercentage(progressPercentage)
            .currentPhase(status.getCurrentPhase())
            .currentChunkNumber(status.getCurrentChunkNumber())
            .compensatingForGuardianId(status.getCompensatingForGuardianId())
            .compensatingForGuardianName(status.getCompensatingForGuardianName())
            .totalCompensatedGuardians(status.getTotalCompensatedGuardians())
            .processedCompensatedGuardians(status.getProcessedCompensatedGuardians())
            .compensatedProgressPercentage(compensatedProgressPercentage)
            .guardianEmail(status.getGuardianEmail())
            .guardianName(status.getGuardianName())
            .startedAt(status.getStartedAt() != null ? status.getStartedAt().toString() : null)
            .completedAt(status.getCompletedAt() != null ? status.getCompletedAt().toString() : null)
            .errorMessage(status.getErrorMessage())
            .build();
    }

    /**
     * Process decryption asynchronously with detailed progress tracking (MEMORY-EFFICIENT)
    */
    @Async
    @Transactional
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
            int totalCompensatedGuardians = allGuardians.size() - 1; // All other guardians except self
            
            // Initialize status with totalCompensatedGuardians set from the beginning
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository
                .findByElectionIdAndGuardianId(request.election_id(), guardian.getGuardianId());
            if (statusOpt.isPresent()) {
                DecryptionStatus status = statusOpt.get();
                status.setStatus("in_progress");
                status.setCurrentPhase("partial_decryption");
                status.setProcessedChunks(0);
                status.setTotalChunks(electionCenterIds.size());
                status.setCurrentChunkNumber(0);
                status.setTotalCompensatedGuardians(totalCompensatedGuardians);
                status.setProcessedCompensatedGuardians(0);
                status.setUpdatedAt(Instant.now());
                decryptionStatusRepository.save(status);
            }
            
            // Get election and choices
            Optional<Election> electionOpt = electionRepository.findById(request.election_id());
            if (!electionOpt.isPresent()) {
                throw new RuntimeException("Election not found");
            }
            Election election = electionOpt.get();
            
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.election_id());
            List<String> candidateNames = choices.stream().map(ElectionChoice::getOptionTitle).toList();
            List<String> partyNames = choices.stream().map(ElectionChoice::getPartyName).toList();
            
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
                
                // DATABASE FETCH 1: Election Center
                long dbStart1 = System.currentTimeMillis();
                System.out.println("🔍 [DB] Fetching election center from database...");
                Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
                long dbDuration1 = System.currentTimeMillis() - dbStart1;
                System.out.println("✅ [DB] Election center fetch completed in " + dbDuration1 + "ms");
                
                if (!electionCenterOpt.isPresent()) {
                    throw new RuntimeException("Election center not found: " + electionCenterId);
                }
                ElectionCenter electionCenter = electionCenterOpt.get();
                
                // Update status with current chunk
                System.out.println("📊 [DB] Updating decryption status...");
                updateDecryptionStatus(request.election_id(), guardian.getGuardianId(), "in_progress",
                    "partial_decryption", processedChunks, electionCenterIds.size(), null, null, null);
                
                // Get encrypted tally for this chunk
                String ciphertextTallyString = electionCenter.getEncryptedTally();
                if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                    throw new RuntimeException("Chunk " + processedChunks + " has no encrypted tally");
                }
                System.out.println("✅ Retrieved encrypted tally (" + ciphertextTallyString.length() + " chars)");
                
                // DATABASE FETCH 2: Submitted Ballots
                long dbStart2 = System.currentTimeMillis();
                System.out.println("🔍 [DB] Fetching submitted ballots for chunk " + electionCenterId + "...");
                List<SubmittedBallot> chunkBallots = submittedBallotRepository.findByElectionCenterId(electionCenterId);
                long dbDuration2 = System.currentTimeMillis() - dbStart2;
                System.out.println("✅ [DB] Submitted ballots fetch completed in " + dbDuration2 + "ms");
                
                if (chunkBallots == null || chunkBallots.isEmpty()) {
                    System.err.println("⚠️ Warning: No submitted ballots found for chunk " + electionCenterId);
                    chunkBallots = new ArrayList<>();
                }
                
                List<String> ballotCipherTexts = chunkBallots.stream()
                    .map(SubmittedBallot::getCipherText)
                    .filter(ct -> ct != null && !ct.trim().isEmpty())
                    .toList();
                
                System.out.println("✅ Extracted " + ballotCipherTexts.size() + " ballot cipher texts");
                
                // Construct guardian_data JSON
                String guardianDataJson = String.format(
                    "{\"id\":\"%s\",\"sequence_order\":%d}",
                    guardian.getSequenceOrder(),
                    guardian.getSequenceOrder()
                );
                
                // Validate required data before calling microservice
                System.out.println("🔍 Validating request data before microservice call...");
                if (decryptedPrivateKey == null || decryptedPrivateKey.trim().isEmpty()) {
                    throw new RuntimeException("Decrypted private key is null or empty");
                }
                if (decryptedPolynomial == null || decryptedPolynomial.trim().isEmpty()) {
                    throw new RuntimeException("Decrypted polynomial is null or empty");
                }
                if (guardian.getGuardianPublicKey() == null || guardian.getGuardianPublicKey().trim().isEmpty()) {
                    throw new RuntimeException("Guardian public key is null or empty");
                }
                if (election.getJointPublicKey() == null || election.getJointPublicKey().trim().isEmpty()) {
                    throw new RuntimeException("Election joint public key is null or empty");
                }
                if (election.getBaseHash() == null || election.getBaseHash().trim().isEmpty()) {
                    throw new RuntimeException("Election base hash is null or empty");
                }
                
                System.out.println("✅ All required data validated");
                System.out.println("---------------------------------------------------------------------");
                System.out.println("🚀 Preparing to call ElectionGuard microservice...");
                
                // Call ElectionGuard microservice
                long microserviceCallStart = System.currentTimeMillis();
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
                    .joint_public_key(election.getJointPublicKey())
                    .commitment_hash(election.getBaseHash())
                    .number_of_guardians(allGuardians.size())
                    .quorum(election.getElectionQuorum())
                    .build();
                
                System.out.println("⏳ Calling ElectionGuard microservice (this may take a while)...");
                ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);
                long microserviceCallDuration = System.currentTimeMillis() - microserviceCallStart;
                System.out.println("✅ Microservice call completed in " + microserviceCallDuration + "ms");
                
                // Additional validation check
                if (guardResponse == null || guardResponse.tally_share() == null) {
                    throw new RuntimeException("Failed to generate decryption shares. This may indicate an issue with the credentials or election configuration.");
                }
                System.out.println("✅ Response validated successfully");
                
                // DATABASE WRITE: Store decryption data
                long dbStart3 = System.currentTimeMillis();
                System.out.println("💾 [DB] Saving decryption data to database...");
                Decryption decryption = Decryption.builder()
                    .electionCenterId(electionCenterId)
                    .guardianId(guardian.getGuardianId())
                    .tallyShare(guardResponse.tally_share())
                    .guardianDecryptionKey(guardResponse.guardian_public_key())
                    .partialDecryptedTally(guardResponse.ballot_shares())
                    .build();
                
                decryptionRepository.save(decryption);
                long dbDuration3 = System.currentTimeMillis() - dbStart3;
                System.out.println("✅ [DB] Decryption data saved in " + dbDuration3 + "ms");
                
                long chunkTotalDuration = System.currentTimeMillis() - chunkStartTime;
                System.out.println("=====================================================================");
                System.out.println("✅ Chunk " + processedChunks + "/" + electionCenterIds.size() + " COMPLETED");
                System.out.println("📊 Timing breakdown:");
                System.out.println("   - DB fetch election center: " + dbDuration1 + "ms");
                System.out.println("   - DB fetch ballots: " + dbDuration2 + "ms");
                System.out.println("   - Microservice call: " + microserviceCallDuration + "ms");
                System.out.println("   - DB save decryption: " + dbDuration3 + "ms");
                System.out.println("   - Total chunk time: " + chunkTotalDuration + "ms");
                System.out.println("=====================================================================");
                
                // MEMORY-EFFICIENT: Clear references to allow garbage collection
                chunkBallots = null;
                ballotCipherTexts = null;
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
            guardian.setDecryptedOrNot(true);
            guardianRepository.save(guardian);
            System.out.println("✅ Guardian marked as fully decrypted (both phases complete)");
            
            // Mark as completed
            updateDecryptionStatus(request.election_id(), guardian.getGuardianId(), "completed",
                "completed", processedChunks, electionCenterIds.size(), null, null, Instant.now());
            
            System.out.println("🎉 DECRYPTION PROCESS COMPLETED SUCCESSFULLY");
            
        } catch (Exception e) {
            System.err.println("❌ Error in async decryption: " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            
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
            
            updateDecryptionStatus(request.election_id(), guardian.getGuardianId(), "failed",
                "error", 0, 0, null, userFriendlyError, null);
        } finally {
            // Release lock
            decryptionLocks.remove(lockKey);
            System.out.println("🔓 Lock released for guardian " + guardian.getGuardianId());
        }
    }

    /**
     * Update decryption status in database
     */
    private void updateDecryptionStatus(Long electionId, Long guardianId, String status, 
                                       String phase, int processedChunks, int totalChunks,
                                       Long compensatingForGuardianId, String errorMessage,
                                       Instant completedAt) {
        try {
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository.findByElectionIdAndGuardianId(electionId, guardianId);
            if (statusOpt.isPresent()) {
                DecryptionStatus decryptionStatus = statusOpt.get();
                decryptionStatus.setStatus(status);
                decryptionStatus.setCurrentPhase(phase);
                decryptionStatus.setProcessedChunks(processedChunks);
                if (totalChunks > 0) {
                    decryptionStatus.setTotalChunks(totalChunks);
                }
                decryptionStatus.setCurrentChunkNumber(processedChunks);
                decryptionStatus.setErrorMessage(errorMessage);
                decryptionStatus.setCompletedAt(completedAt);
                decryptionStatus.setUpdatedAt(Instant.now());
                
                if (compensatingForGuardianId != null) {
                    decryptionStatus.setCompensatingForGuardianId(compensatingForGuardianId);
                    // Get guardian email as name
                    Optional<Guardian> compensatedGuardian = guardianRepository.findById(compensatingForGuardianId);
                    compensatedGuardian.ifPresent(g -> 
                        decryptionStatus.setCompensatingForGuardianName(g.getUserEmail())
                    );
                }
                
                decryptionStatusRepository.save(decryptionStatus);
            }
        } catch (Exception e) {
            System.err.println("Failed to update decryption status: " + e.getMessage());
        }
    }

    /**
     * Create compensated decryption shares with progress tracking (MEMORY-EFFICIENT)
     */
    private void createCompensatedDecryptionSharesWithProgress(Election election, Guardian guardian, 
                                                              String decryptedPrivateKey, String decryptedPolynomial,
                                                              List<Long> electionCenterIds) {
        try {
            List<Guardian> allGuardians = guardianRepository.findByElectionId(election.getElectionId());
            List<Guardian> otherGuardians = allGuardians.stream()
                .filter(g -> !g.getGuardianId().equals(guardian.getGuardianId()))
                .collect(Collectors.toList());
            
            System.out.println("Creating compensated shares for " + otherGuardians.size() + " other guardians");
            
            // Update total compensated guardians and reset chunk tracking for compensated phase
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository
                .findByElectionIdAndGuardianId(election.getElectionId(), guardian.getGuardianId());
            if (statusOpt.isPresent()) {
                DecryptionStatus status = statusOpt.get();
                status.setTotalCompensatedGuardians(otherGuardians.size());
                status.setProcessedCompensatedGuardians(0);
                // Reset chunk tracking for compensated phase - total is guardians × chunks
                status.setTotalChunks(otherGuardians.size() * electionCenterIds.size());
                status.setProcessedChunks(0);
                status.setCurrentChunkNumber(0);
                decryptionStatusRepository.save(status);
            }
            
            int processedGuardians = 0;
            int totalCompensatedChunks = otherGuardians.size() * electionCenterIds.size();
            int processedCompensatedChunks = 0;
            
            for (Guardian otherGuardian : otherGuardians) {
                processedGuardians++;
                System.out.println("💫 Creating compensated shares for guardian: " + otherGuardian.getUserEmail() 
                    + " (" + processedGuardians + "/" + otherGuardians.size() + ")");
                
                // Update status with current compensating guardian
                Optional<DecryptionStatus> currentStatus = decryptionStatusRepository
                    .findByElectionIdAndGuardianId(election.getElectionId(), guardian.getGuardianId());
                if (currentStatus.isPresent()) {
                    DecryptionStatus status = currentStatus.get();
                    status.setCurrentPhase("compensated_shares_generation");
                    status.setCompensatingForGuardianId(otherGuardian.getGuardianId());
                    status.setCompensatingForGuardianName(otherGuardian.getUserEmail());
                    status.setProcessedCompensatedGuardians(processedGuardians - 1); // Set to previous count, will be incremented after all chunks
                    status.setUpdatedAt(Instant.now());
                    decryptionStatusRepository.save(status);
                }
                
                int chunkNumber = 0;
                // Process each chunk for this guardian (MEMORY-EFFICIENT)
                for (Long electionCenterId : electionCenterIds) {
                    chunkNumber++;
                    
                    System.out.println("Fetching election center " + electionCenterId + " for chunk " + chunkNumber + "...");
                    
                    // MEMORY-EFFICIENT: Fetch only the election center needed for this iteration
                    Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
                    if (!electionCenterOpt.isPresent()) {
                        System.err.println("Election center not found: " + electionCenterId);
                        continue;
                    }
                    ElectionCenter electionCenter = electionCenterOpt.get();
                    
                    // Check if compensated decryption already exists
                    boolean existsAlready = compensatedDecryptionRepository
                        .existsByElectionCenterIdAndCompensatingGuardianIdAndMissingGuardianId(
                            electionCenter.getElectionCenterId(),
                            guardian.getGuardianId(),
                            otherGuardian.getGuardianId()
                        );
                    
                    if (existsAlready) {
                        System.out.println("Compensated decryption already exists, skipping...");
                        // MEMORY-EFFICIENT: Clear reference
                        electionCenterOpt = null;
                        continue;
                    }
                    
                    // Prepare required data for compensated decryption
                    List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
                    List<String> candidateNames = electionChoices.stream()
                        .map(ElectionChoice::getOptionTitle)
                        .collect(Collectors.toList());
                    List<String> partyNames = electionChoices.stream()
                        .map(ElectionChoice::getPartyName)
                        .filter(partyName -> partyName != null && !partyName.trim().isEmpty())
                        .distinct()
                        .collect(Collectors.toList());
                    
                    // Get submitted ballots for this chunk
                    List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionCenterId(electionCenter.getElectionCenterId());
                    List<String> ballotCipherTexts = submittedBallots.stream()
                        .map(SubmittedBallot::getCipherText)
                        .collect(Collectors.toList());
                    
                    // Get guardian data from key_backup field
                    String availableGuardianDataJson;
                    if (guardian.getKeyBackup() != null && !guardian.getKeyBackup().trim().isEmpty()) {
                        availableGuardianDataJson = guardian.getKeyBackup();
                    } else {
                        availableGuardianDataJson = String.format(
                            "{\"id\":\"%s\",\"sequence_order\":%d}",
                            guardian.getSequenceOrder(),
                            guardian.getSequenceOrder()
                        );
                    }
                    
                    String missingGuardianDataJson;
                    if (otherGuardian.getKeyBackup() != null && !otherGuardian.getKeyBackup().trim().isEmpty()) {
                        missingGuardianDataJson = otherGuardian.getKeyBackup();
                    } else {
                        missingGuardianDataJson = String.format(
                            "{\"id\":\"%s\",\"sequence_order\":%d}",
                            otherGuardian.getSequenceOrder(),
                            otherGuardian.getSequenceOrder()
                        );
                    }
                    
                    // Call ElectionGuard service to generate compensated share with ALL required fields
                    ElectionGuardCompensatedDecryptionRequest compensatedRequest = 
                        ElectionGuardCompensatedDecryptionRequest.builder()
                            .available_guardian_id(String.valueOf(guardian.getSequenceOrder()))
                            .missing_guardian_id(String.valueOf(otherGuardian.getSequenceOrder()))
                            .available_guardian_data(availableGuardianDataJson)
                            .missing_guardian_data(missingGuardianDataJson)
                            .available_private_key(decryptedPrivateKey)
                            .available_public_key(guardian.getGuardianPublicKey())
                            .available_polynomial(decryptedPolynomial)
                            .party_names(partyNames)
                            .candidate_names(candidateNames)
                            .ciphertext_tally(electionCenter.getEncryptedTally())
                            .submitted_ballots(ballotCipherTexts)
                            .joint_public_key(election.getJointPublicKey())
                            .commitment_hash(election.getBaseHash())
                            .number_of_guardians(guardianRepository.findByElectionId(election.getElectionId()).size())
                            .quorum(election.getElectionQuorum())
                            .build();
                    
                    ElectionGuardCompensatedDecryptionResponse compensatedResponse = 
                        callElectionGuardCompensatedDecryptionService(compensatedRequest);
                    
                    if (compensatedResponse == null || compensatedResponse.compensated_tally_share() == null) {
                        System.err.println("Failed to get compensated decryption response from microservice");
                        continue;
                    }
                    
                    // Save compensated decryption
                    CompensatedDecryption compensatedDecryption = CompensatedDecryption.builder()
                        .electionCenterId(electionCenter.getElectionCenterId())
                        .compensatingGuardianId(guardian.getGuardianId())
                        .missingGuardianId(otherGuardian.getGuardianId())
                        .compensatedTallyShare(compensatedResponse.compensated_tally_share())
                        .compensatedBallotShare(compensatedResponse.compensated_ballot_shares())
                        .build();
                    
                    compensatedDecryptionRepository.save(compensatedDecryption);
                    
                    // Update chunk progress after each chunk
                    processedCompensatedChunks++;
                    System.out.println("📦 Compensated chunk " + chunkNumber + "/" + electionCenterIds.size() 
                        + " for guardian " + otherGuardian.getUserEmail() 
                        + " (Total: " + processedCompensatedChunks + "/" + totalCompensatedChunks + ")");
                    
                    Optional<DecryptionStatus> chunkStatus = decryptionStatusRepository
                        .findByElectionIdAndGuardianId(election.getElectionId(), guardian.getGuardianId());
                    if (chunkStatus.isPresent()) {
                        DecryptionStatus status = chunkStatus.get();
                        status.setProcessedChunks(processedCompensatedChunks);
                        status.setCurrentChunkNumber(chunkNumber);
                        status.setUpdatedAt(Instant.now());
                        decryptionStatusRepository.save(status);
                    }
                    
                    // MEMORY-EFFICIENT: Clear references to allow garbage collection
                    ballotCipherTexts = null;
                }
                
                // Update guardian progress after all chunks for this guardian are processed
                Optional<DecryptionStatus> guardianStatus = decryptionStatusRepository
                    .findByElectionIdAndGuardianId(election.getElectionId(), guardian.getGuardianId());
                if (guardianStatus.isPresent()) {
                    DecryptionStatus status = guardianStatus.get();
                    status.setProcessedCompensatedGuardians(processedGuardians);
                    status.setUpdatedAt(Instant.now());
                    decryptionStatusRepository.save(status);
                }
                
                System.out.println("✅ Compensated shares created for " + otherGuardian.getUserEmail());
            }
            
            System.out.println("✅ PHASE 2 COMPLETED: Compensated shares for all " + processedGuardians + " guardians");
            
        } catch (Exception e) {
            System.err.println("Error creating compensated shares: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private ElectionGuardPartialDecryptionResponse callElectionGuardPartialDecryptionService(
            ElectionGuardPartialDecryptionRequest request) {
        
        long startTime = System.currentTimeMillis();
        String threadName = Thread.currentThread().getName();
        long threadId = Thread.currentThread().getId();
        
        System.out.println("=====================================================================");
        System.out.println("⚙️ [BACKEND][Thread-" + threadName + ":" + threadId + "] CALLING ELECTIONGUARD MICROSERVICE");
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
            e.printStackTrace();
            throw new RuntimeException("Failed to call ElectionGuard partial decryption service", e);
        }
    }

    /**
     * Initiate async combine partial decryption process
     */
    public CombinePartialDecryptionResponse initiateCombine(Long electionId, String userEmail) {
        try {
            // 1. Check if combine already exists or is in progress
            Optional<CombineStatus> existingStatus = combineStatusRepository.findByElectionId(electionId);
            
            if (existingStatus.isPresent()) {
                CombineStatus status = existingStatus.get();
                
                if ("in_progress".equals(status.getStatus())) {
                    System.out.println("⚠️ Combine already in progress for election " + electionId);
                    return CombinePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Combine is already in progress")
                        .build();
                }
                
                if ("completed".equals(status.getStatus())) {
                    System.out.println("✅ Combine already completed for election " + electionId);
                    return CombinePartialDecryptionResponse.builder()
                        .success(true)
                        .message("Combine already completed for this election")
                        .build();
                }
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
                // 3. Get election centers to determine total chunks
                List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
                if (electionCenters == null || electionCenters.isEmpty()) {
                    combineLocks.remove(electionId);
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("No election centers found. Please create tally first.")
                        .build();
                }
                
                // 4. Create or update combine status
                CombineStatus combineStatus = existingStatus.orElse(CombineStatus.builder()
                    .electionId(electionId)
                    .createdBy(userEmail)
                    .totalChunks(electionCenters.size())
                    .processedChunks(0)
                    .startedAt(Instant.now())
                    .build());
                
                combineStatus.setStatus("pending");
                combineStatus.setStartedAt(Instant.now());
                combineStatus.setTotalChunks(electionCenters.size());
                combineStatus.setProcessedChunks(0);
                combineStatus.setErrorMessage(null);
                
                combineStatusRepository.save(combineStatus);
                
                System.out.println("✅ Combine status created. Starting async processing...");
                
                // 5. Start async processing
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
            e.printStackTrace();
            return CombinePartialDecryptionResponse.builder()
                .success(false)
                .message("Failed to initiate combine: " + e.getMessage())
                .build();
        }
    }

    /**
     * Process combine asynchronously with progress updates
     */
    @Async
    public void processCombineAsync(Long electionId) {
        try {
            System.out.println("=== ASYNC COMBINE STARTED ===");
            System.out.println("Election ID: " + electionId);
            
            // Get total chunks count
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            int totalChunks = electionCenters != null ? electionCenters.size() : 0;
            
            // Update status to in_progress with total chunks
            updateCombineStatus(electionId, "in_progress", 0, null);
            
            // Call the existing combine method
            CombinePartialDecryptionRequest request = new CombinePartialDecryptionRequest(electionId);
            CombinePartialDecryptionResponse response = combinePartialDecryption(request);
            
            if (response.success()) {
                // Mark as completed with correct processed chunks count
                updateCombineStatus(electionId, "completed", totalChunks, Instant.now());
                System.out.println("🎉 COMBINE PROCESS COMPLETED SUCCESSFULLY - Processed " + totalChunks + " chunks");
            } else {
                updateCombineStatus(electionId, "failed", 0, response.message());
                System.err.println("❌ COMBINE PROCESS FAILED: " + response.message());
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error in async combine: " + e.getMessage());
            e.printStackTrace();
            updateCombineStatus(electionId, "failed", 0, e.getMessage());
        } finally {
            // Release lock
            combineLocks.remove(electionId);
            System.out.println("🔓 Lock released for election " + electionId);
        }
    }

    /**
     * Update combine status in database
     */
    private void updateCombineStatus(Long electionId, String status, Integer processedChunks, Object completedAtOrError) {
        try {
            Optional<CombineStatus> statusOpt = combineStatusRepository.findByElectionId(electionId);
            if (statusOpt.isPresent()) {
                CombineStatus combineStatus = statusOpt.get();
                combineStatus.setStatus(status);
                
                if (processedChunks != null) {
                    combineStatus.setProcessedChunks(processedChunks);
                }
                
                if (completedAtOrError instanceof Instant) {
                    combineStatus.setCompletedAt((Instant) completedAtOrError);
                } else if (completedAtOrError instanceof String) {
                    combineStatus.setErrorMessage((String) completedAtOrError);
                }
                
                combineStatusRepository.save(combineStatus);
            }
        } catch (Exception e) {
            System.err.println("Failed to update combine status: " + e.getMessage());
        }
    }

    /**
     * Get current combine status for an election
     */
    public CombineStatusResponse getCombineStatus(Long electionId) {
        Optional<CombineStatus> statusOpt = combineStatusRepository.findByElectionId(electionId);
        
        if (statusOpt.isEmpty()) {
            return CombineStatusResponse.notFound();
        }
        
        CombineStatus status = statusOpt.get();
        double progressPercentage = status.getTotalChunks() > 0 
            ? (status.getProcessedChunks() * 100.0) / status.getTotalChunks()
            : 0.0;
        
        return CombineStatusResponse.builder()
            .success(true)
            .status(status.getStatus())
            .message("Combine status retrieved successfully")
            .totalChunks(status.getTotalChunks())
            .processedChunks(status.getProcessedChunks())
            .progressPercentage(progressPercentage)
            .createdBy(status.getCreatedBy())
            .startedAt(status.getStartedAt())
            .completedAt(status.getCompletedAt())
            .errorMessage(status.getErrorMessage())
            .build();
    }

    @Transactional
    public CombinePartialDecryptionResponse combinePartialDecryption(CombinePartialDecryptionRequest request) {
        try {
            System.out.println("=== COMBINE PARTIAL DECRYPTION STARTED (Memory-Efficient Mode) ===");
            
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
                Object cachedResults = buildAggregatedResultsFromChunks(electionCenters, request.election_id());
                
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
                
                // Update progress at start of chunk processing
                updateCombineStatus(request.election_id(), "in_progress", processedChunkCount - 1, null);
                
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
                
                // MEMORY-EFFICIENT: Clear references to allow garbage collection
                chunkSubmittedBallots = null;
                ballotCipherTexts = null;
                decryptions = null;
                guardianDecryptionMap = null;
                guardianDataList = null;
                availableGuardianIds = null;
                availableGuardianPublicKeys = null;
                availableTallyShares = null;
                availableBallotShares = null;
                missingGuardianIds = null;
                compensatingGuardianIds = null;
                compensatedTallyShares = null;
                compensatedBallotShares = null;
            }
            
            // Update final progress after all chunks processed
            updateCombineStatus(request.election_id(), "in_progress", processedChunkCount, null);
            
            // After processing all chunks, fetch all centers to build aggregated results
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
            Object aggregatedResults = buildAggregatedResultsFromChunks(electionCenters, request.election_id());
            updateElectionChoicesWithResults(request.election_id(), aggregatedResults, electionChoices);
            
            // Update election status to 'decrypted'
            election.setStatus("decrypted");
            electionRepository.save(election);
            
            System.out.println("✅ Successfully combined partial decryptions for election: " + request.election_id());
            System.out.println("✅ Updated election status to 'decrypted'");
            System.out.println("✅ Election results are now available for viewing");
            
            return CombinePartialDecryptionResponse.builder()
                .success(true)
                .message("Election results successfully decrypted and ready for viewing")
                .results(aggregatedResults)
                .build();

        } catch (Exception e) {
            System.err.println("Error combining partial decryption: " + e.getMessage());
            e.printStackTrace();
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
                            if (votesObj instanceof String) {
                                voteCount = Integer.parseInt((String) votesObj);
                            } else if (votesObj instanceof Integer) {
                                voteCount = (Integer) votesObj;
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
            e.printStackTrace();
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
            System.out.println("📦 PROCESSING CHUNKS (Memory-Efficient)");
            System.out.println("-".repeat(80));
            
            // Process each chunk (MEMORY-EFFICIENT)
            for (Long electionCenterId : electionCenterIds) {
                System.out.println("\n📍 Chunk " + electionCenterId + " | Guardian " + availableGuardian.getSequenceOrder() + " creating shares for others");
                System.out.println("Fetching election center from database...");
                
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
                    
                    System.out.println("  Checking: Guardian " + availableGuardian.getSequenceOrder() + " → Guardian " + otherGuardian.getSequenceOrder() + 
                                     " (Exists: " + alreadyExists + ")");
                    
                    if (!alreadyExists) {
                        // Create compensated share from this guardian for the other guardian for this chunk
                        System.out.println("  🔧 Creating share: Guardian " + availableGuardian.getSequenceOrder() + " compensating for Guardian " + otherGuardian.getSequenceOrder());
                        createCompensatedShare(election, electionCenter, availableGuardian, otherGuardian, availableGuardianPrivateKey, availableGuardianPolynomial);
                        System.out.println("  ✅ Successfully created compensated share");
                        createdCount++;
                    } else {
                        System.out.println("  ⏭️ Skipped (already exists)");
                        skippedCount++;
                    }
                }
                
                System.out.println("  📊 Summary for Chunk " + electionCenterId + ": Created=" + createdCount + ", Skipped=" + skippedCount);
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
            e.printStackTrace();
        }
    }
    
    /**
     * Creates a compensated decryption share for a specific other guardian using a compensating guardian for a specific chunk
     */
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
            
        } catch (Exception e) {
            System.err.println("Error creating compensated share: " + e.getMessage());
            e.printStackTrace();
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

            return objectMapper.readValue(response, ElectionGuardCompensatedDecryptionResponse.class);
                
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

            return objectMapper.readValue(response, ElectionGuardCombineDecryptionSharesResponse.class);
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
        try {
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            
            if (electionCenters == null || electionCenters.isEmpty()) {
                System.out.println("No election centers found for election: " + electionId);
                return null;
            }
            
            // Check if any chunks have results
            boolean anyChunkHasResults = electionCenters.stream()
                .anyMatch(ec -> ec.getElectionResult() != null && !ec.getElectionResult().trim().isEmpty());
            
            if (!anyChunkHasResults) {
                System.out.println("No results computed yet for election: " + electionId);
                return null;
            }
            
            // Build and return aggregated results
            return buildAggregatedResultsFromChunks(electionCenters, electionId);
            
        } catch (Exception e) {
            System.err.println("Error getting election results: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Parses the results string from the microservice response
     */
    private Object parseResultsString(String resultsString) {
        try {
            return objectMapper.readValue(resultsString, Object.class);
        } catch (Exception e) {
            System.err.println("Error parsing results string: " + e.getMessage());
            return resultsString; // Return as string if parsing fails
        }
    }

    /**
     * Builds aggregated results from all chunk election_result data
     * Combines per-chunk results into a single comprehensive result object
     */
    private Object buildAggregatedResultsFromChunks(List<ElectionCenter> electionCenters, Long electionId) {
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
                                
                                if (value instanceof Number) {
                                    votes = ((Number) value).intValue();
                                } else if (value instanceof Map) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> voteData = (Map<String, Object>) value;
                                    Object votesObj = voteData.get("votes");
                                    if (votesObj instanceof Number) {
                                        votes = ((Number) votesObj).intValue();
                                    } else if (votesObj instanceof String) {
                                        try {
                                            votes = Integer.parseInt((String) votesObj);
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
                                if (value instanceof Number) {
                                    votes = ((Number) value).intValue();
                                } else if (value instanceof Map) {
                                    // Extract votes from nested object: {"votes": "2", "percentage": "50.0"}
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> voteData = (Map<String, Object>) value;
                                    Object votesObj = voteData.get("votes");
                                    if (votesObj instanceof Number) {
                                        votes = ((Number) votesObj).intValue();
                                    } else if (votesObj instanceof String) {
                                        try {
                                            votes = Integer.parseInt((String) votesObj);
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
            e.printStackTrace();
            return new HashMap<>();
        }
    }
}
