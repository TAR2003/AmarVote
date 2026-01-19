package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesRequest;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesResponse;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardTallyRequest;
import com.amarvote.amarvote.dto.ElectionGuardTallyResponse;
import com.amarvote.amarvote.dto.worker.CombineDecryptionTask;
import com.amarvote.amarvote.dto.worker.CompensatedDecryptionTask;
import com.amarvote.amarvote.dto.worker.PartialDecryptionTask;
import com.amarvote.amarvote.dto.worker.TallyCreationTask;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.CombineStatus;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.DecryptionStatus;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.model.TallyCreationStatus;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.CombineStatusRepository;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionStatusRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.repository.TallyCreationStatusRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;

/**
 * Worker service that processes tasks from RabbitMQ queues.
 * Each task is processed individually with memory released after completion.
 * Concurrency is limited to 1 per queue to prevent concurrent processing of the same election/guardian.
 */
@Service
@RequiredArgsConstructor
public class TaskWorkerService {

    @PersistenceContext
    private EntityManager entityManager;

    private final BallotRepository ballotRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final DecryptionRepository decryptionRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final TallyCreationStatusRepository tallyCreationStatusRepository;
    private final DecryptionStatusRepository decryptionStatusRepository;
    private final CombineStatusRepository combineStatusRepository;
    private final ElectionRepository electionRepository;
    private final GuardianRepository guardianRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final DecryptionTaskQueueService decryptionTaskQueueService;
    
    @Autowired
    private ElectionGuardService electionGuardService;
    
    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    
    @Autowired
    private CredentialCacheService credentialCacheService;

    // Track currently processing tasks to prevent duplicates (per election/guardian)
    private static final ConcurrentHashMap<String, Boolean> processingLocks = new ConcurrentHashMap<>();

    /**
     * Worker for tally creation tasks
     * Processes one chunk of ballots at a time
     */
    @RabbitListener(queues = RabbitMQConfig.TALLY_CREATION_QUEUE, concurrency = "${rabbitmq.worker.concurrency.min}-${rabbitmq.worker.concurrency.max}")
    @Transactional
    public void processTallyCreationTask(TallyCreationTask task) {
        String lockKey = "tally_" + task.getElectionId() + "_chunk_" + task.getChunkNumber();
        
        if (processingLocks.putIfAbsent(lockKey, true) != null) {
            System.out.println("⚠️ Chunk already being processed: " + lockKey);
            return;
        }
        
        try {
            System.out.println("=== WORKER: Processing Tally Creation Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Election ID: " + task.getElectionId());
            System.out.println("Ballot IDs: " + task.getBallotIds().size());
            
            // Log memory before
            Runtime runtime = Runtime.getRuntime();
            long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("🧠 Memory before: " + memoryBeforeMB + " MB");
            
            // Fetch only the ballots needed for this chunk
            List<Ballot> chunkBallots = ballotRepository.findByBallotIdIn(task.getBallotIds());
            
            // Create election center entry
            ElectionCenter electionCenter = ElectionCenter.builder()
                .electionId(task.getElectionId())
                .build();
            electionCenter = electionCenterRepository.save(electionCenter);
            
            // Extract cipher texts
            List<String> chunkEncryptedBallots = chunkBallots.stream()
                .map(Ballot::getCipherText)
                .collect(Collectors.toList());
            
            // Build request
            ElectionGuardTallyRequest guardRequest = ElectionGuardTallyRequest.builder()
                .party_names(task.getPartyNames())
                .candidate_names(task.getCandidateNames())
                .joint_public_key(task.getJointPublicKey())
                .commitment_hash(task.getBaseHash())
                .encrypted_ballots(chunkEncryptedBallots)
                .quorum(task.getQuorum())
                .number_of_guardians(task.getNumberOfGuardians())
                .build();
            
            // Call ElectionGuard service
            System.out.println("🚀 Calling ElectionGuard service for chunk " + task.getChunkNumber());
            String response = electionGuardService.postRequest("/create_encrypted_tally", guardRequest);
            ElectionGuardTallyResponse guardResponse = objectMapper.readValue(response, ElectionGuardTallyResponse.class);
            
            if (!"success".equals(guardResponse.getStatus())) {
                throw new RuntimeException("ElectionGuard service failed: " + guardResponse.getMessage());
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
            
            // Update progress
            updateTallyProgress(task.getElectionId(), task.getChunkNumber());
            
            // CRITICAL: Aggressive memory cleanup
            entityManager.flush();
            entityManager.clear();
            
            chunkBallots.clear();
            chunkEncryptedBallots.clear();
            
            // Log memory after
            long memoryAfterMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("✅ Chunk " + task.getChunkNumber() + " complete. Memory freed: " + (memoryBeforeMB - memoryAfterMB) + " MB");
            System.out.println("🧠 Memory after: " + memoryAfterMB + " MB");
            
        } catch (Exception e) {
            System.err.println("❌ Error processing tally chunk: " + e.getMessage());
            e.printStackTrace();
            updateTallyError(task.getElectionId(), e.getMessage());
        } finally {
            processingLocks.remove(lockKey);
            System.gc(); // Suggest garbage collection
        }
    }

    /**
     * Worker for partial decryption tasks
     * Processes one chunk at a time for a specific guardian
     */
    @RabbitListener(queues = RabbitMQConfig.PARTIAL_DECRYPTION_QUEUE, concurrency = "${rabbitmq.worker.concurrency.min}-${rabbitmq.worker.concurrency.max}")
    @Transactional
    public void processPartialDecryptionTask(PartialDecryptionTask task) {
        String lockKey = "partial_" + task.getElectionId() + "_g" + task.getGuardianId() + "_chunk_" + task.getChunkNumber();
        
        if (processingLocks.putIfAbsent(lockKey, true) != null) {
            System.out.println("⚠️ Chunk already being processed: " + lockKey);
            return;
        }
        
        try {
            System.out.println("=== WORKER: Processing Partial Decryption Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Election ID: " + task.getElectionId() + ", Guardian: " + task.getGuardianId());
            
            // Log memory before
            Runtime runtime = Runtime.getRuntime();
            long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("🧠 Memory before: " + memoryBeforeMB + " MB");
            
            // Fetch election center
            ElectionCenter electionCenter = electionCenterRepository.findById(task.getElectionCenterId())
                .orElseThrow(() -> new RuntimeException("ElectionCenter not found: " + task.getElectionCenterId()));
            
            // Get encrypted tally
            String ciphertextTallyString = electionCenter.getEncryptedTally();
            if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                throw new RuntimeException("Chunk has no encrypted tally");
            }
            
            // Load ballot cipher texts (strings only, not full entities)
            List<String> ballotCipherTexts = submittedBallotRepository.findCipherTextsByElectionCenterId(task.getElectionCenterId());
            
            // Construct guardian_data JSON
            String guardianDataJson = String.format(
                "{\"id\":\"%s\",\"sequence_order\":%s}",
                task.getGuardianSequenceOrder(),
                task.getGuardianSequenceOrder()
            );
            
            // Build request
            ElectionGuardPartialDecryptionRequest guardRequest = ElectionGuardPartialDecryptionRequest.builder()
                .guardian_id(task.getGuardianSequenceOrder())
                .guardian_data(guardianDataJson)
                .private_key(task.getDecryptedPrivateKey())
                .public_key(task.getGuardianPublicKey())
                .polynomial(task.getDecryptedPolynomial())
                .party_names(task.getPartyNames())
                .candidate_names(task.getCandidateNames())
                .ciphertext_tally(ciphertextTallyString)
                .submitted_ballots(ballotCipherTexts)
                .joint_public_key(task.getJointPublicKey())
                .commitment_hash(task.getBaseHash())
                .number_of_guardians(task.getNumberOfGuardians())
                .quorum(task.getQuorum())
                .build();
            
            // Call ElectionGuard service
            System.out.println("🚀 Calling ElectionGuard service for partial decryption");
            String response = electionGuardService.postRequest("/create_partial_decryption", guardRequest);
            ElectionGuardPartialDecryptionResponse guardResponse = objectMapper.readValue(response, ElectionGuardPartialDecryptionResponse.class);
            
            if (guardResponse.tally_share() == null) {
                throw new RuntimeException("Invalid credentials provided");
            }
            
            // Store decryption data
            Decryption decryption = Decryption.builder()
                .electionCenterId(task.getElectionCenterId())
                .guardianId(task.getGuardianId())
                .tallyShare(guardResponse.tally_share())
                .guardianDecryptionKey(guardResponse.guardian_public_key())
                .partialDecryptedTally(guardResponse.ballot_shares())
                .build();
            
            decryptionRepository.save(decryption);
            
            // Update progress
            updatePartialDecryptionProgress(task.getElectionId(), task.getGuardianId(), task.getChunkNumber());
            
            // CRITICAL: Memory cleanup
            entityManager.flush();
            entityManager.clear();
            
            ballotCipherTexts.clear();
            
            // Log memory after
            long memoryAfterMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("✅ Chunk " + task.getChunkNumber() + " complete. Memory freed: " + (memoryBeforeMB - memoryAfterMB) + " MB");
            System.out.println("🧠 Memory after: " + memoryAfterMB + " MB");
            
        } catch (Exception e) {
            System.err.println("❌ Error processing partial decryption chunk: " + e.getMessage());
            e.printStackTrace();
            updatePartialDecryptionError(task.getElectionId(), task.getGuardianId(), e.getMessage());
        } finally {
            processingLocks.remove(lockKey);
            System.gc(); // Suggest garbage collection
        }
    }

    /**
     * Worker for compensated decryption tasks
     * Processes one compensated share at a time
     */
    @RabbitListener(queues = RabbitMQConfig.COMPENSATED_DECRYPTION_QUEUE, concurrency = "${rabbitmq.worker.concurrency.min}-${rabbitmq.worker.concurrency.max}")
    @Transactional
    public void processCompensatedDecryptionTask(CompensatedDecryptionTask task) {
        String lockKey = "compensated_" + task.getElectionId() + "_g" + task.getSourceGuardianId() + 
                        "_for_" + task.getTargetGuardianId() + "_chunk_" + task.getChunkNumber();
        
        if (processingLocks.putIfAbsent(lockKey, true) != null) {
            System.out.println("⚠️ Compensated share already being processed: " + lockKey);
            return;
        }
        
        try {
            System.out.println("=== WORKER: Processing Compensated Decryption Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Source Guardian: " + task.getSourceGuardianId() + ", Target Guardian: " + task.getTargetGuardianId());
            
            // Log memory before
            Runtime runtime = Runtime.getRuntime();
            long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("🧠 Memory before: " + memoryBeforeMB + " MB");
            
            // Fetch election center
            ElectionCenter electionCenter = electionCenterRepository.findById(task.getElectionCenterId())
                .orElseThrow(() -> new RuntimeException("ElectionCenter not found: " + task.getElectionCenterId()));
            
            // Get encrypted tally
            String ciphertextTallyString = electionCenter.getEncryptedTally();
            
            // Load ballot cipher texts
            List<String> ballotCipherTexts = submittedBallotRepository.findCipherTextsByElectionCenterId(task.getElectionCenterId());
            
            // Use full guardian data from keyBackup (includes backups field)
            // If keyBackup is not available, construct minimal data as fallback
            String sourceGuardianDataJson;
            if (task.getSourceGuardianKeyBackup() != null && !task.getSourceGuardianKeyBackup().trim().isEmpty()) {
                sourceGuardianDataJson = task.getSourceGuardianKeyBackup();
            } else {
                // Fallback to minimal JSON (will fail if backups are needed)
                sourceGuardianDataJson = String.format(
                    "{\"id\":\"%s\",\"sequence_order\":%s}",
                    task.getSourceGuardianSequenceOrder(),
                    task.getSourceGuardianSequenceOrder()
                );
            }
            
            String targetGuardianDataJson;
            if (task.getTargetGuardianKeyBackup() != null && !task.getTargetGuardianKeyBackup().trim().isEmpty()) {
                targetGuardianDataJson = task.getTargetGuardianKeyBackup();
            } else {
                // Fallback to minimal JSON
                targetGuardianDataJson = String.format(
                    "{\"id\":\"%s\",\"sequence_order\":%s}",
                    task.getTargetGuardianSequenceOrder(),
                    task.getTargetGuardianSequenceOrder()
                );
            }
            
            // Build request
            ElectionGuardCompensatedDecryptionRequest guardRequest = ElectionGuardCompensatedDecryptionRequest.builder()
                .available_guardian_id(task.getSourceGuardianSequenceOrder())
                .available_guardian_data(sourceGuardianDataJson)
                .available_private_key(task.getDecryptedPrivateKey())
                .available_public_key(task.getSourceGuardianPublicKey())
                .available_polynomial(task.getDecryptedPolynomial())
                .missing_guardian_id(task.getTargetGuardianSequenceOrder())
                .missing_guardian_data(targetGuardianDataJson)
                .party_names(task.getPartyNames())
                .candidate_names(task.getCandidateNames())
                .ciphertext_tally(ciphertextTallyString)
                .submitted_ballots(ballotCipherTexts)
                .joint_public_key(task.getJointPublicKey())
                .commitment_hash(task.getBaseHash())
                .number_of_guardians(task.getNumberOfGuardians())
                .quorum(task.getQuorum())
                .build();
            
            // Call ElectionGuard service with retry logic
            System.out.println("🚀 Calling ElectionGuard service for compensated decryption");
            System.out.println("📦 Request size - Ballots: " + ballotCipherTexts.size() + ", Tally length: " + ciphertextTallyString.length());
            
            String response = null;
            ElectionGuardCompensatedDecryptionResponse guardResponse = null;
            int maxRetries = 3;
            int attempt = 0;
            
            while (attempt < maxRetries) {
                try {
                    attempt++;
                    if (attempt > 1) {
                        System.out.println("⚠️ Retry attempt " + attempt + "/" + maxRetries);
                        Thread.sleep(2000 * attempt); // Exponential backoff
                    }
                    
                    response = electionGuardService.postRequest("/create_compensated_decryption", guardRequest);
                    guardResponse = objectMapper.readValue(response, ElectionGuardCompensatedDecryptionResponse.class);
                    break; // Success, exit retry loop
                    
                } catch (Exception e) {
                    if (attempt >= maxRetries) {
                        System.err.println("❌ All retry attempts failed for compensated decryption");
                        throw new RuntimeException("Failed to create compensated share after " + maxRetries + " attempts: " + e.getMessage(), e);
                    }
                    System.err.println("⚠️ Attempt " + attempt + "/" + maxRetries + " failed: " + e.getMessage());
                }
            }
            
            if (guardResponse.compensated_tally_share() == null) {
                throw new RuntimeException("Failed to generate compensated share");
            }
            
            // Store compensated decryption
            CompensatedDecryption compensatedDecryption = CompensatedDecryption.builder()
                .electionCenterId(task.getElectionCenterId())
                .missingGuardianId(task.getTargetGuardianId())
                .compensatingGuardianId(task.getSourceGuardianId())
                .compensatedTallyShare(guardResponse.compensated_tally_share())
                .compensatedBallotShare(guardResponse.compensated_ballot_shares())
                .build();
            
            compensatedDecryptionRepository.save(compensatedDecryption);
            
            // Update progress
            updateCompensatedDecryptionProgress(task.getElectionId(), task.getSourceGuardianId());
            
            // CRITICAL: Memory cleanup
            entityManager.flush();
            entityManager.clear();
            
            ballotCipherTexts.clear();
            
            // Log memory after
            long memoryAfterMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("✅ Compensated chunk complete. Memory freed: " + (memoryBeforeMB - memoryAfterMB) + " MB");
            System.out.println("🧠 Memory after: " + memoryAfterMB + " MB");
            
        } catch (Exception e) {
            System.err.println("❌ Error processing compensated decryption: " + e.getMessage());
            e.printStackTrace();
            updateCompensatedDecryptionError(task.getElectionId(), task.getSourceGuardianId(), e.getMessage());
        } finally {
            processingLocks.remove(lockKey);
            System.gc(); // Suggest garbage collection
        }
    }

    /**
     * Worker for combine decryption tasks
     * Processes one chunk at a time to combine all decryption shares
     */
    @RabbitListener(queues = RabbitMQConfig.COMBINE_DECRYPTION_QUEUE, concurrency = "${rabbitmq.worker.concurrency.min}-${rabbitmq.worker.concurrency.max}")
    @Transactional
    public void processCombineDecryptionTask(CombineDecryptionTask task) {
        String lockKey = "combine_" + task.getElectionId() + "_chunk_" + task.getChunkNumber();
        
        if (processingLocks.putIfAbsent(lockKey, true) != null) {
            System.out.println("⚠️ Combine chunk already being processed: " + lockKey);
            return;
        }
        
        try {
            System.out.println("=== WORKER: Processing Combine Decryption Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Election ID: " + task.getElectionId());
            
            // Log memory before
            Runtime runtime = Runtime.getRuntime();
            long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("🧠 Memory before: " + memoryBeforeMB + " MB");
            
            // Fetch election and guardians
            Election election = electionRepository.findById(task.getElectionId())
                .orElseThrow(() -> new RuntimeException("Election not found"));
            
            List<Guardian> guardians = guardianRepository.findByElectionId(task.getElectionId());
            List<Guardian> availableGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() != null && g.getDecryptedOrNot())
                .collect(Collectors.toList());
            
            // Fetch election center
            ElectionCenter electionCenter = electionCenterRepository.findById(task.getElectionCenterId())
                .orElseThrow(() -> new RuntimeException("ElectionCenter not found"));
            
            // Get submitted ballots
            List<SubmittedBallot> chunkSubmittedBallots = submittedBallotRepository.findByElectionCenterId(task.getElectionCenterId());
            List<String> ballotCipherTexts = chunkSubmittedBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .collect(Collectors.toList());
            
            // Get decryptions for this chunk
            List<Decryption> decryptions = decryptionRepository.findByElectionCenterId(task.getElectionCenterId());
            Map<Long, Decryption> guardianDecryptionMap = decryptions.stream()
                .collect(Collectors.toMap(Decryption::getGuardianId, d -> d, (d1, d2) -> d1));
            
            // Build guardian data list
            List<String> guardianDataList = new ArrayList<>();
            for (Guardian guardian : guardians) {
                if (guardian.getKeyBackup() != null && !guardian.getKeyBackup().trim().isEmpty()) {
                    guardianDataList.add(guardian.getKeyBackup());
                } else {
                    String guardianDataJson = String.format(
                        "{\"id\":\"%s\",\"sequence_order\":%d}",
                        guardian.getSequenceOrder(),
                        guardian.getSequenceOrder()
                    );
                    guardianDataList.add(guardianDataJson);
                }
            }
            
            // Available guardian data
            List<String> availableGuardianIds = availableGuardians.stream()
                .map(g -> String.valueOf(g.getSequenceOrder()))
                .collect(Collectors.toList());
            
            List<String> availableGuardianPublicKeys = new ArrayList<>();
            List<String> availableTallyShares = new ArrayList<>();
            List<String> availableBallotShares = new ArrayList<>();
            
            for (Guardian guardian : availableGuardians) {
                Decryption decryption = guardianDecryptionMap.get(guardian.getGuardianId());
                if (decryption == null) {
                    throw new RuntimeException("Missing decryption data for guardian " + guardian.getSequenceOrder());
                }
                
                availableGuardianPublicKeys.add(decryption.getGuardianDecryptionKey());
                availableTallyShares.add(decryption.getTallyShare());
                availableBallotShares.add(decryption.getPartialDecryptedTally());
            }
            
            // Handle missing guardians
            List<Guardian> missingGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() == null || !g.getDecryptedOrNot())
                .sorted((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()))
                .collect(Collectors.toList());
            
            List<String> missingGuardianIds = new ArrayList<>();
            List<String> compensatingGuardianIds = new ArrayList<>();
            List<String> compensatedTallyShares = new ArrayList<>();
            List<String> compensatedBallotShares = new ArrayList<>();
            
            if (!missingGuardians.isEmpty()) {
                for (Guardian missingGuardian : missingGuardians) {
                    List<CompensatedDecryption> compensatedDecryptions = compensatedDecryptionRepository
                        .findByElectionCenterIdAndMissingGuardianId(
                            task.getElectionCenterId(),
                            missingGuardian.getGuardianId()
                        );
                    
                    Map<Long, CompensatedDecryption> cdMap = new HashMap<>();
                    for (CompensatedDecryption cd : compensatedDecryptions) {
                        cdMap.put(cd.getCompensatingGuardianId(), cd);
                    }
                    
                    List<Guardian> sortedAvailableGuardians = availableGuardians.stream()
                        .sorted((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()))
                        .collect(Collectors.toList());
                    
                    for (Guardian compensatingGuardian : sortedAvailableGuardians) {
                        CompensatedDecryption cd = cdMap.get(compensatingGuardian.getGuardianId());
                        if (cd != null) {
                            missingGuardianIds.add(String.valueOf(missingGuardian.getSequenceOrder()));
                            compensatingGuardianIds.add(String.valueOf(compensatingGuardian.getSequenceOrder()));
                            compensatedTallyShares.add(cd.getCompensatedTallyShare());
                            compensatedBallotShares.add(cd.getCompensatedBallotShare());
                        }
                    }
                }
            }
            
            // Build request
            ElectionGuardCombineDecryptionSharesRequest guardRequest = ElectionGuardCombineDecryptionSharesRequest.builder()
                .party_names(task.getPartyNames())
                .candidate_names(task.getCandidateNames())
                .ciphertext_tally(electionCenter.getEncryptedTally())
                .submitted_ballots(ballotCipherTexts)
                .joint_public_key(task.getJointPublicKey())
                .commitment_hash(task.getBaseHash())
                .number_of_guardians(task.getNumberOfGuardians())
                .quorum(task.getQuorum())
                .guardian_data(guardianDataList)
                .available_guardian_ids(availableGuardianIds)
                .available_guardian_public_keys(availableGuardianPublicKeys)
                .available_tally_shares(availableTallyShares)
                .available_ballot_shares(availableBallotShares)
                .missing_guardian_ids(missingGuardianIds)
                .compensating_guardian_ids(compensatingGuardianIds)
                .compensated_tally_shares(compensatedTallyShares)
                .compensated_ballot_shares(compensatedBallotShares)
                .build();
            
            // Call ElectionGuard service
            System.out.println("🚀 Calling ElectionGuard service for combine decryption");
            String response = electionGuardService.postRequest("/combine_decryption_shares", guardRequest);
            ElectionGuardCombineDecryptionSharesResponse guardResponse = objectMapper.readValue(response, ElectionGuardCombineDecryptionSharesResponse.class);
            
            if (guardResponse.results() == null) {
                throw new RuntimeException("Failed to combine decryption shares");
            }
            
            // Store results
            electionCenter.setElectionResult(guardResponse.results());
            electionCenterRepository.save(electionCenter);
            
            // Update progress
            updateCombineDecryptionProgress(task.getElectionId(), task.getChunkNumber());
            
            // CRITICAL: Memory cleanup
            entityManager.flush();
            entityManager.clear();
            
            ballotCipherTexts.clear();
            decryptions.clear();
            guardianDataList.clear();
            
            // Log memory after
            long memoryAfterMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("✅ Combine chunk complete. Memory freed: " + (memoryBeforeMB - memoryAfterMB) + " MB");
            System.out.println("🧠 Memory after: " + memoryAfterMB + " MB");
            
        } catch (Exception e) {
            System.err.println("❌ Error processing combine decryption: " + e.getMessage());
            e.printStackTrace();
            updateCombineDecryptionError(task.getElectionId(), e.getMessage());
        } finally {
            processingLocks.remove(lockKey);
            System.gc(); // Suggest garbage collection
        }
    }

    // ========== Progress Tracking Methods ==========
    
    private void updateTallyProgress(Long electionId, int completedChunk) {
        try {
            Optional<TallyCreationStatus> statusOpt = tallyCreationStatusRepository.findByElectionId(electionId);
            if (statusOpt.isPresent()) {
                TallyCreationStatus status = statusOpt.get();
                // Increment processed count (chunks are 0-based, so +1 to get count)
                int currentProcessed = status.getProcessedChunks() != null ? status.getProcessedChunks() : 0;
                int newProcessed = currentProcessed + 1;
                status.setProcessedChunks(newProcessed);
                
                System.out.println("📊 Tally Progress (Chunk " + completedChunk + "): " + newProcessed + "/" + status.getTotalChunks() + " chunks completed");
                
                // Check if all chunks are completed
                if (newProcessed >= status.getTotalChunks()) {
                    status.setStatus("completed");
                    status.setCompletedAt(Instant.now());
                    System.out.println("✅ All tally chunks completed for election " + electionId + " (" + newProcessed + "/" + status.getTotalChunks() + ")");
                } else {
                    System.out.println("⏳ Tally in progress: " + newProcessed + "/" + status.getTotalChunks() + " (" + (status.getTotalChunks() - newProcessed) + " remaining)");
                }
                
                tallyCreationStatusRepository.save(status);
            } else {
                System.err.println("⚠️ No TallyCreationStatus found for election " + electionId + " while updating progress");
            }
        } catch (Exception e) {
            System.err.println("❌ Failed to update tally progress: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void updateTallyError(Long electionId, String errorMessage) {
        try {
            Optional<TallyCreationStatus> statusOpt = tallyCreationStatusRepository.findByElectionId(electionId);
            if (statusOpt.isPresent()) {
                TallyCreationStatus status = statusOpt.get();
                status.setStatus("failed");
                status.setErrorMessage(errorMessage);
                status.setCompletedAt(Instant.now());
                tallyCreationStatusRepository.save(status);
            }
        } catch (Exception e) {
            System.err.println("Failed to update tally error: " + e.getMessage());
        }
    }
    
    private void updatePartialDecryptionProgress(Long electionId, Long guardianId, int completedChunk) {
        try {
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository.findByElectionIdAndGuardianId(electionId, guardianId);
            if (statusOpt.isPresent()) {
                DecryptionStatus status = statusOpt.get();
                // Increment processed count (chunks are 0-based, so +1 to get count)
                int currentProcessed = status.getProcessedChunks() != null ? status.getProcessedChunks() : 0;
                status.setProcessedChunks(currentProcessed + 1);
                status.setCurrentChunkNumber(completedChunk);
                status.setUpdatedAt(Instant.now());
                
                System.out.println("📊 Partial Decryption Progress (Guardian " + guardianId + "): " + 
                    status.getProcessedChunks() + "/" + status.getTotalChunks() + " chunks completed");
                
                // Check if all partial decryption chunks are completed
                if (status.getProcessedChunks() >= status.getTotalChunks() && 
                    "partial_decryption".equals(status.getCurrentPhase())) {
                    
                    System.out.println("✅ All partial decryption chunks completed for guardian " + guardianId);
                    System.out.println("=== PHASE 1 COMPLETED - NOW QUEUEING PHASE 2 (COMPENSATED DECRYPTION) ===");
                    
                    // Check if this is a single guardian election (no compensated shares needed)
                    int totalCompensatedGuardians = status.getTotalCompensatedGuardians() != null ? 
                        status.getTotalCompensatedGuardians() : 0;
                    
                    if (totalCompensatedGuardians == 0) {
                        // Single guardian - mark as completed immediately
                        status.setStatus("completed");
                        status.setCurrentPhase("completed");
                        status.setPartialDecryptionCompletedAt(Instant.now());
                        status.setCompletedAt(Instant.now());
                        
                        // Clear credentials from Redis cache
                        credentialCacheService.clearCredentials(electionId, guardianId);
                        
                        // Mark guardian as decrypted (needed for frontend combine button)
                        markGuardianAsDecrypted(guardianId);
                        
                        System.out.println("✅ Single guardian election - decryption completed for guardian " + guardianId);
                    } else {
                        // Multiple guardians - transition to compensated shares phase
                        // and QUEUE compensated tasks NOW
                        status.setCurrentPhase("compensated_shares_generation");
                        status.setPartialDecryptionCompletedAt(Instant.now());
                        status.setCompensatedSharesStartedAt(Instant.now());
                        status.setProcessedChunks(0); // Reset for compensated phase tracking
                        
                        System.out.println("🔄 Transitioning to compensated shares generation phase");
                        System.out.println("📊 Need to generate shares for " + totalCompensatedGuardians + " other guardians");
                        
                        // Get stored credentials from Redis (secure in-memory cache)
                        String decryptedPrivateKey = credentialCacheService.getPrivateKey(electionId, guardianId);
                        String decryptedPolynomial = credentialCacheService.getPolynomial(electionId, guardianId);
                        
                        if (decryptedPrivateKey == null || decryptedPolynomial == null) {
                            System.err.println("❌ ERROR: Missing credentials in Redis cache (may have expired)");
                            System.err.println("❌ Cannot queue compensated tasks without credentials");
                            status.setStatus("failed");
                            status.setErrorMessage("Internal error: Decryption credentials expired or missing from cache");
                            decryptionStatusRepository.save(status);
                            return;
                        }
                        
                        // Save the status first
                        decryptionStatusRepository.save(status);
                        
                        // ✅ CRITICAL FIX: Queue compensated decryption tasks NOW
                        System.out.println("🚀 Queueing compensated decryption tasks for guardian " + guardianId);
                        
                        // Get election center IDs (chunks)
                        List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
                        List<Long> electionCenterIds = electionCenters.stream()
                            .map(ElectionCenter::getElectionCenterId)
                            .sorted()
                            .collect(Collectors.toList());
                        
                        // Update total chunks for compensated phase
                        int totalCompensatedTasks = electionCenterIds.size() * totalCompensatedGuardians;
                        status.setTotalChunks(totalCompensatedTasks);
                        decryptionStatusRepository.save(status);
                        
                        System.out.println("📋 Total compensated tasks to queue: " + totalCompensatedTasks + 
                            " (" + electionCenterIds.size() + " chunks × " + totalCompensatedGuardians + " guardians)");
                        
                        // Queue the tasks
                        try {
                            decryptionTaskQueueService.queueCompensatedDecryptionTasks(
                                electionId,
                                guardianId,
                                electionCenterIds,
                                decryptedPrivateKey,
                                decryptedPolynomial
                            );
                            System.out.println("✅ Compensated decryption tasks queued successfully");
                        } catch (Exception e) {
                            System.err.println("❌ Failed to queue compensated tasks: " + e.getMessage());
                            e.printStackTrace();
                            status.setStatus("failed");
                            status.setErrorMessage("Failed to queue compensated tasks: " + e.getMessage());
                            decryptionStatusRepository.save(status);
                        }
                        
                        return; // Exit early since we saved already
                    }
                }
                
                decryptionStatusRepository.save(status);
            }
        } catch (Exception e) {
            System.err.println("Failed to update partial decryption progress: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void updatePartialDecryptionError(Long electionId, Long guardianId, String errorMessage) {
        try {
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository.findByElectionIdAndGuardianId(electionId, guardianId);
            if (statusOpt.isPresent()) {
                DecryptionStatus status = statusOpt.get();
                status.setStatus("failed");
                status.setErrorMessage(errorMessage);
                status.setCompletedAt(Instant.now());
                decryptionStatusRepository.save(status);
            }
        } catch (Exception e) {
            System.err.println("Failed to update partial decryption error: " + e.getMessage());
        }
    }
    
    private void updateCompensatedDecryptionProgress(Long electionId, Long guardianId) {
        try {
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository.findByElectionIdAndGuardianId(electionId, guardianId);
            if (statusOpt.isPresent()) {
                DecryptionStatus status = statusOpt.get();
                
                // Increment processed chunks count (each compensated task is one chunk×guardian combo)
                int currentProcessed = status.getProcessedChunks() != null ? status.getProcessedChunks() : 0;
                status.setProcessedChunks(currentProcessed + 1);
                status.setUpdatedAt(Instant.now());
                
                // totalChunks is ALREADY chunks × totalCompensatedGuardians
                // (set in line 901 of PartialDecryptionService)
                int totalCompensatedTasks = status.getTotalChunks() != null ? status.getTotalChunks() : 0;
                
                System.out.println("📊 Compensated Decryption Progress (Guardian " + guardianId + "): " + 
                    status.getProcessedChunks() + "/" + totalCompensatedTasks + " tasks completed");
                
                // Check if all compensated tasks are completed
                if (totalCompensatedTasks > 0 && status.getProcessedChunks() >= totalCompensatedTasks) {
                    status.setStatus("completed");
                    status.setCurrentPhase("completed");
                    status.setCompensatedSharesCompletedAt(Instant.now());
                    status.setCompletedAt(Instant.now());
                    
                    // ✅ Clear credentials from Redis cache now that we're done
                    credentialCacheService.clearCredentials(electionId, guardianId);
                    
                    // Mark guardian as decrypted (needed for frontend combine button)
                    markGuardianAsDecrypted(guardianId);
                    
                    System.out.println("✅ All compensated decryption tasks completed for guardian " + guardianId);
                    System.out.println("🔒 Credentials securely removed from Redis cache");
                }
                
                decryptionStatusRepository.save(status);
            }
        } catch (Exception e) {
            System.err.println("Failed to update compensated decryption progress: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void updateCompensatedDecryptionError(Long electionId, Long guardianId, String errorMessage) {
        try {
            Optional<DecryptionStatus> statusOpt = decryptionStatusRepository.findByElectionIdAndGuardianId(electionId, guardianId);
            if (statusOpt.isPresent()) {
                DecryptionStatus status = statusOpt.get();
                status.setStatus("failed");
                status.setErrorMessage(errorMessage);
                status.setCompletedAt(Instant.now());
                decryptionStatusRepository.save(status);
            }
        } catch (Exception e) {
            System.err.println("Failed to update compensated decryption error: " + e.getMessage());
        }
    }
    
    private void updateCombineDecryptionProgress(Long electionId, int completedChunk) {
        try {
            Optional<CombineStatus> statusOpt = combineStatusRepository.findByElectionId(electionId);
            if (statusOpt.isPresent()) {
                CombineStatus status = statusOpt.get();
                // Increment processed count (chunks are 0-based, so +1 to get count)
                int currentProcessed = status.getProcessedChunks() != null ? status.getProcessedChunks() : 0;
                int newProcessed = currentProcessed + 1;
                status.setProcessedChunks(newProcessed);
                
                System.out.println("📊 Combine Decryption Progress (Chunk " + completedChunk + "): " + newProcessed + "/" + status.getTotalChunks() + " chunks completed");
                
                // Check if all chunks are completed
                if (newProcessed >= status.getTotalChunks()) {
                    status.setStatus("completed");
                    status.setCompletedAt(Instant.now());
                    System.out.println("✅ All combine decryption chunks completed for election " + electionId + " (" + newProcessed + "/" + status.getTotalChunks() + ")");
                } else {
                    System.out.println("⏳ Combine in progress: " + newProcessed + "/" + status.getTotalChunks() + " (" + (status.getTotalChunks() - newProcessed) + " remaining)");
                }
                
                combineStatusRepository.save(status);
            } else {
                System.err.println("⚠️ No CombineStatus found for election " + electionId + " while updating progress");
            }
        } catch (Exception e) {
            System.err.println("❌ Failed to update combine decryption progress: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void updateCombineDecryptionError(Long electionId, String errorMessage) {
        try {
            Optional<CombineStatus> statusOpt = combineStatusRepository.findByElectionId(electionId);
            if (statusOpt.isPresent()) {
                CombineStatus status = statusOpt.get();
                status.setStatus("failed");
                status.setErrorMessage(errorMessage);
                status.setCompletedAt(Instant.now());
                combineStatusRepository.save(status);
            }
        } catch (Exception e) {
            System.err.println("Failed to update combine decryption error: " + e.getMessage());
        }
    }
    
    /**
     * Mark guardian as decrypted in separate transaction
     * This is needed for the frontend to show the combine button
     */
    @Transactional
    private void markGuardianAsDecrypted(Long guardianId) {
        try {
            Optional<Guardian> guardianOpt = guardianRepository.findById(guardianId);
            if (guardianOpt.isPresent()) {
                Guardian guardian = guardianOpt.get();
                guardian.setDecryptedOrNot(true);
                guardianRepository.save(guardian);
                System.out.println("✅ Guardian " + guardianId + " marked as decrypted (decryptedOrNot=true)");
            }
        } catch (Exception e) {
            System.err.println("Failed to mark guardian as decrypted: " + e.getMessage());
        }
    }
}
