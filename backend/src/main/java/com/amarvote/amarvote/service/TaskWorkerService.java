package com.amarvote.amarvote.service;

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
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.repository.TallyWorkerLogRepository;
import com.amarvote.amarvote.repository.DecryptionWorkerLogRepository;
import com.amarvote.amarvote.repository.CombineWorkerLogRepository;
import com.amarvote.amarvote.model.TallyWorkerLog;
import com.amarvote.amarvote.model.DecryptionWorkerLog;
import com.amarvote.amarvote.model.CombineWorkerLog;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

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
    private final ElectionRepository electionRepository;
    private final GuardianRepository guardianRepository;
    private final DecryptionTaskQueueService decryptionTaskQueueService;
    private final TallyWorkerLogRepository tallyWorkerLogRepository;
    private final DecryptionWorkerLogRepository decryptionWorkerLogRepository;
    private final CombineWorkerLogRepository combineWorkerLogRepository;
    
    @Autowired
    private ElectionGuardService electionGuardService;
    
    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    
    @Autowired
    private CredentialCacheService credentialCacheService;
    
    @Autowired
    private RoundRobinTaskScheduler roundRobinTaskScheduler;

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
        
        // Initialize worker log
        TallyWorkerLog workerLog = null;
        Long electionCenterId = null;
        
        try {
            System.out.println("=== WORKER: Processing Tally Creation Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Election ID: " + task.getElectionId());
            System.out.println("Ballot IDs: " + task.getBallotIds().size());
            System.out.println("Chunk ID: " + task.getChunkId());
            
            // Create election center entry first to get ID
            ElectionCenter electionCenter = ElectionCenter.builder()
                .electionId(task.getElectionId())
                .build();
            electionCenter = electionCenterRepository.save(electionCenter);
            electionCenterId = electionCenter.getElectionCenterId();
            
            // LOG START TIME - Create worker log entry
            workerLog = TallyWorkerLog.builder()
                .electionId(task.getElectionId())
                .electionCenterId(electionCenterId)
                .chunkNumber(task.getChunkNumber())
                .startTime(LocalDateTime.now())
                .status("IN_PROGRESS")
                .build();
            workerLog = tallyWorkerLogRepository.save(workerLog);
            System.out.println("📊 Tally worker log created: ID=" + workerLog.getTallyWorkerLogId());
            
            // Report state: PROCESSING
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.PROCESSING, 
                    null
                );
            }
            
            // Log memory before
            Runtime runtime = Runtime.getRuntime();
            long memoryBeforeMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            System.out.println("🧠 Memory before: " + memoryBeforeMB + " MB");
            
            // Fetch only the ballots needed for this chunk
            List<Ballot> chunkBallots = ballotRepository.findByBallotIdIn(task.getBallotIds());
            
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
            
            System.out.println("✅ Chunk " + task.getChunkNumber() + " processing complete");
            
            // LOG END TIME - Update worker log with completion
            workerLog.setEndTime(LocalDateTime.now());
            workerLog.setStatus("COMPLETED");
            tallyWorkerLogRepository.save(workerLog);
            System.out.println("📊 Tally worker log updated: COMPLETED");
            
            // Report state: COMPLETED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.COMPLETED, 
                    null
                );
            }
            
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
            
            // LOG ERROR - Update worker log with failure
            if (workerLog != null) {
                workerLog.setEndTime(LocalDateTime.now());
                workerLog.setStatus("FAILED");
                workerLog.setErrorMessage(e.getMessage());
                tallyWorkerLogRepository.save(workerLog);
                System.out.println("📊 Tally worker log updated: FAILED");
            }
            
            // Report state: FAILED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.FAILED, 
                    e.getMessage()
                );
            }
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
        
        // Initialize worker log
        DecryptionWorkerLog workerLog = null;
        
        try {
            System.out.println("=== WORKER: Processing Partial Decryption Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Election ID: " + task.getElectionId() + ", Guardian: " + task.getGuardianId());
            System.out.println("Chunk ID: " + task.getChunkId());
            
            // LOG START TIME - Create worker log entry
            workerLog = DecryptionWorkerLog.builder()
                .electionId(task.getElectionId())
                .electionCenterId(task.getElectionCenterId())
                .guardianId(task.getGuardianId())
                .decryptingGuardianId(task.getGuardianId()) // Same for partial decryption
                .decryptionType("PARTIAL")
                .chunkNumber(task.getChunkNumber())
                .startTime(LocalDateTime.now())
                .status("IN_PROGRESS")
                .build();
            workerLog = decryptionWorkerLogRepository.save(workerLog);
            System.out.println("📊 Decryption worker log created: ID=" + workerLog.getDecryptionWorkerLogId());
            
            // Report state: PROCESSING
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.PROCESSING, 
                    null
                );
            }
            
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
            
            // LOG END TIME - Update worker log with completion
            workerLog.setEndTime(LocalDateTime.now());
            workerLog.setStatus("COMPLETED");
            decryptionWorkerLogRepository.save(workerLog);
            System.out.println("📊 Decryption worker log updated: COMPLETED");
            
            // Report state: COMPLETED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.COMPLETED, 
                    null
                );
            }
            
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
            
            // LOG ERROR - Update worker log with failure
            if (workerLog != null) {
                workerLog.setEndTime(LocalDateTime.now());
                workerLog.setStatus("FAILED");
                workerLog.setErrorMessage(e.getMessage());
                decryptionWorkerLogRepository.save(workerLog);
                System.out.println("📊 Decryption worker log updated: FAILED");
            }
            
            // Report state: FAILED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.FAILED, 
                    e.getMessage()
                );
            }
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
        
        // Initialize worker log
        DecryptionWorkerLog workerLog = null;
        
        try {
            System.out.println("=== WORKER: Processing Compensated Decryption Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Source Guardian: " + task.getSourceGuardianId() + ", Target Guardian: " + task.getTargetGuardianId());
            System.out.println("Chunk ID: " + task.getChunkId());
            
            // LOG START TIME - Create worker log entry
            workerLog = DecryptionWorkerLog.builder()
                .electionId(task.getElectionId())
                .electionCenterId(task.getElectionCenterId())
                .guardianId(task.getTargetGuardianId()) // Missing guardian being compensated
                .decryptingGuardianId(task.getSourceGuardianId()) // Guardian doing the compensation
                .decryptionType("COMPENSATED")
                .chunkNumber(task.getChunkNumber())
                .startTime(LocalDateTime.now())
                .status("IN_PROGRESS")
                .build();
            workerLog = decryptionWorkerLogRepository.save(workerLog);
            System.out.println("📊 Compensated decryption worker log created: ID=" + workerLog.getDecryptionWorkerLogId());
            
            // Report state: PROCESSING
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.PROCESSING, 
                    null
                );
            }
            
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
            
            // LOG END TIME - Update worker log with completion
            workerLog.setEndTime(LocalDateTime.now());
            workerLog.setStatus("COMPLETED");
            decryptionWorkerLogRepository.save(workerLog);
            System.out.println("📊 Compensated decryption worker log updated: COMPLETED");
            
            // Report state: COMPLETED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.COMPLETED, 
                    null
                );
            }
            
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
            
            // LOG ERROR - Update worker log with failure
            if (workerLog != null) {
                workerLog.setEndTime(LocalDateTime.now());
                workerLog.setStatus("FAILED");
                workerLog.setErrorMessage(e.getMessage());
                decryptionWorkerLogRepository.save(workerLog);
                System.out.println("📊 Compensated decryption worker log updated: FAILED");
            }
            
            // Report state: FAILED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.FAILED, 
                    e.getMessage()
                );
            }
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
        
        // Initialize worker log
        CombineWorkerLog workerLog = null;
        
        try {
            System.out.println("=== WORKER: Processing Combine Decryption Chunk " + task.getChunkNumber() + " ===");
            System.out.println("Election ID: " + task.getElectionId());
            System.out.println("Chunk ID: " + task.getChunkId());
            
            // LOG START TIME - Create worker log entry
            workerLog = CombineWorkerLog.builder()
                .electionId(task.getElectionId())
                .electionCenterId(task.getElectionCenterId())
                .chunkNumber(task.getChunkNumber())
                .startTime(LocalDateTime.now())
                .status("IN_PROGRESS")
                .build();
            workerLog = combineWorkerLogRepository.save(workerLog);
            System.out.println("📊 Combine worker log created: ID=" + workerLog.getCombineWorkerLogId());
            
            // Report state: PROCESSING
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.PROCESSING, 
                    null
                );
            }
            
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
            
            // LOG END TIME - Update worker log with completion
            workerLog.setEndTime(LocalDateTime.now());
            workerLog.setStatus("COMPLETED");
            combineWorkerLogRepository.save(workerLog);
            System.out.println("📊 Combine worker log updated: COMPLETED");
            
            // Report state: COMPLETED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.COMPLETED, 
                    null
                );
            }
            
            // Removed: updateCombineDecryptionProgress - status is now queried directly from database
            System.out.println("✅ Combine chunk " + task.getChunkNumber() + " completed");
            
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
            
            // LOG ERROR - Update worker log with failure
            if (workerLog != null) {
                workerLog.setEndTime(LocalDateTime.now());
                workerLog.setStatus("FAILED");
                workerLog.setErrorMessage(e.getMessage());
                combineWorkerLogRepository.save(workerLog);
                System.out.println("📊 Combine worker log updated: FAILED");
            }
            
            // Report state: FAILED
            if (task.getChunkId() != null) {
                roundRobinTaskScheduler.updateChunkState(
                    task.getChunkId(), 
                    com.amarvote.amarvote.model.scheduler.ChunkState.FAILED, 
                    e.getMessage()
                );
            }
        } finally {
            processingLocks.remove(lockKey);
            System.gc(); // Suggest garbage collection
        }
    }

    // ========== Progress Tracking Methods (Removed - Status Now Queried from Database) ==========
    
    // Removed: updateTallyProgress - status is now queried directly from database
    // No need to update status tables - the frontend queries directly from election_center table
    
    // Removed: updateTallyError - errors can be handled without status table
    
    private void updatePartialDecryptionProgress(Long electionId, Long guardianId, int completedChunk) {
        try {
            System.out.println("📊 Partial Decryption Progress (Guardian " + guardianId + "): Chunk " + completedChunk + " completed");
            
            // Check if all partial decryption chunks are completed by querying database
            List<Long> allChunks = electionCenterRepository.findElectionCenterIdsByElectionId(electionId);
            long completedCount = decryptionRepository.countByElectionIdAndGuardianId(electionId, guardianId);
            
            System.out.println("📊 Completed " + completedCount + "/" + allChunks.size() + " partial decryption chunks");
            
            // Check if all partial decryption chunks are completed
            if (completedCount >= allChunks.size()) {
                System.out.println("✅ All partial decryption chunks completed for guardian " + guardianId);
                System.out.println("=== PHASE 1 COMPLETED - NOW QUEUEING PHASE 2 (COMPENSATED DECRYPTION) ===");
                
                // Check if this is a single guardian election (no compensated shares needed)
                List<Guardian> allGuardians = guardianRepository.findByElectionId(electionId);
                int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);
                
                if (totalCompensatedGuardians == 0) {
                    // Single guardian - mark as completed immediately
                    credentialCacheService.clearCredentials(electionId, guardianId);
                    markGuardianAsDecrypted(guardianId);
                    System.out.println("✅ Single guardian election - decryption completed for guardian " + guardianId);
                } else {
                    // Multiple guardians - queue compensated decryption tasks
                    System.out.println("🔄 Transitioning to compensated shares generation phase");
                    System.out.println("📊 Need to generate shares for " + totalCompensatedGuardians + " other guardians");
                    
                    // Get stored credentials from Redis (secure in-memory cache)
                    String decryptedPrivateKey = credentialCacheService.getPrivateKey(electionId, guardianId);
                    String decryptedPolynomial = credentialCacheService.getPolynomial(electionId, guardianId);
                    
                    if (decryptedPrivateKey == null || decryptedPolynomial == null) {
                        System.err.println("❌ ERROR: Missing credentials in Redis cache (may have expired)");
                        System.err.println("❌ Cannot queue compensated tasks without credentials");
                        return;
                    }
                    
                    // ✅ Queue compensated decryption tasks NOW
                    System.out.println("🚀 Queueing compensated decryption tasks for guardian " + guardianId);
                    
                    // Get election center IDs (chunks)
                    List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
                    List<Long> electionCenterIds = electionCenters.stream()
                        .map(ElectionCenter::getElectionCenterId)
                        .sorted()
                        .collect(Collectors.toList());
                    
                    int totalCompensatedTasks = electionCenterIds.size() * totalCompensatedGuardians;
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
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to update partial decryption progress: " + e.getMessage());
        }
    }
    
    // Removed: updatePartialDecryptionError - errors can be handled without status table
    
    private void updateCompensatedDecryptionProgress(Long electionId, Long guardianId) {
        try {
            System.out.println("📊 Compensated Decryption Progress for guardian " + guardianId);
            
            // Query database to check if all compensated decryptions are done
            List<Long> allChunks = electionCenterRepository.findElectionCenterIdsByElectionId(electionId);
            List<Guardian> allGuardians = guardianRepository.findByElectionId(electionId);
            int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);
            
            if (totalCompensatedGuardians > 0) {
                long compensatedCount = compensatedDecryptionRepository
                    .countByElectionIdAndCompensatingGuardianId(electionId, guardianId);
                long totalExpected = (long) allChunks.size() * totalCompensatedGuardians;
                
                System.out.println("📊 Compensated progress: " + compensatedCount + "/" + totalExpected + " completed");
                
                // Check if all compensated shares are completed
                if (compensatedCount >= totalExpected) {
                    System.out.println("✅ ALL COMPENSATED SHARES COMPLETED FOR GUARDIAN " + guardianId);
                    
                    // ✅ Clear credentials from Redis cache now that we're done
                    credentialCacheService.clearCredentials(electionId, guardianId);
                    
                    // Mark guardian as decrypted (needed for frontend combine button)
                    markGuardianAsDecrypted(guardianId);
                    
                    System.out.println("✅ Decryption fully completed for guardian " + guardianId);
                    System.out.println("🔒 Credentials securely removed from Redis cache");
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to update compensated decryption progress: " + e.getMessage());
        }
    }
    
    // Removed: updateCompensatedDecryptionError - errors can be handled without status table
    
    // Removed: updateCombineDecryptionProgress - status is now queried directly from database
    
    // Removed: updateCombineDecryptionError - errors can be handled without status table
    
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
