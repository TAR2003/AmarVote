package com.amarvote.amarvote.worker;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionResponse;
import com.amarvote.amarvote.dto.queue.ChunkMessage;
import com.amarvote.amarvote.dto.queue.OperationType;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.service.ElectionGuardService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Worker that processes partial decryption messages from RabbitMQ
 * 
 * MEMORY-EFFICIENT DESIGN:
 * - Processes ONE chunk (ElectionCenter) at a time
 * - Loads only submitted ballots for that chunk
 * - Clears EntityManager after each chunk
 * - Each worker uses ~150-200 MB regardless of total chunks
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DecryptionWorker {

    private final ElectionJobRepository jobRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final DecryptionRepository decryptionRepository;
    private final ElectionGuardService electionGuardService;
    private final ObjectMapper objectMapper;
    
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Listen to decryption queue and process one chunk at a time
     * 
     * NOTE: No @Transactional here - RabbitMQ listeners manage their own message transactions.
     * Database operations are in separate @Transactional methods (incrementProcessedChunks).
     */
    @RabbitListener(queues = RabbitMQConfig.DECRYPTION_QUEUE)
    public void processDecryptionChunk(ChunkMessage message) {
        log.info("=== Decryption Worker Processing Chunk ===");
        log.info("Job ID: {}, Chunk ID: {}, Guardian ID: {}", 
                 message.getJobId(), message.getChunkId(), message.getGuardianId());
        
        // Track memory
        Runtime runtime = Runtime.getRuntime();
        long memoryBefore = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        log.info("🧠 Memory before chunk: {} MB", memoryBefore);
        
        try {
            // Validate message
            if (message.getOperationType() != OperationType.DECRYPTION) {
                throw new IllegalArgumentException("Invalid operation type: " + message.getOperationType());
            }
            
            // Load job to get metadata
            Optional<ElectionJob> jobOpt = jobRepository.findById(message.getJobId());
            if (jobOpt.isEmpty()) {
                throw new RuntimeException("Job not found: " + message.getJobId());
            }
            
            ElectionJob job = jobOpt.get();
            
            // Parse metadata (contains guardian credentials and election parameters)
            DecryptionMetadata metadata = objectMapper.readValue(job.getMetadata(), DecryptionMetadata.class);
            
            // Load ElectionCenter (this chunk)
            ElectionCenter center = electionCenterRepository.findById(message.getChunkId())
                    .orElseThrow(() -> new RuntimeException("ElectionCenter not found: " + message.getChunkId()));
            
            // Load submitted ballots for THIS chunk only
            List<SubmittedBallot> submittedBallots = submittedBallotRepository
                    .findByElectionCenterId(message.getChunkId());
            
            log.info("✅ Processing {} submitted ballots for chunk {}", 
                     submittedBallots.size(), message.getChunkId());
            
            if (submittedBallots.isEmpty()) {
                log.warn("⚠️ No submitted ballots found for chunk {}", message.getChunkId());
                incrementProcessedChunks(message.getJobId());
                return;
            }
            
            // Extract cipher texts
            List<String> submittedBallotCipherTexts = submittedBallots.stream()
                    .map(SubmittedBallot::getCipherText)
                    .collect(Collectors.toList());
            
            // Call ElectionGuard service for partial decryption
            ElectionGuardPartialDecryptionResponse response = callElectionGuardPartialDecryptionService(
                    metadata, center.getEncryptedTally(), submittedBallotCipherTexts);
            
            if (!"success".equals(response.status())) {
                throw new RuntimeException("ElectionGuard partial decryption failed: " + response.status());
            }
            
            // Check if decryption already exists
            boolean exists = decryptionRepository.existsByGuardianIdAndElectionCenterId(
                    message.getGuardianId(), message.getChunkId());
            
            if (!exists) {
                // Save decryption result
                Decryption decryption = Decryption.builder()
                        .guardianId(message.getGuardianId())
                        .electionCenterId(message.getChunkId())
                        .tallyShare(response.tally_share())
                        .partialDecryptedTally(response.ballot_shares())
                        .build();
                decryptionRepository.save(decryption);
            } else {
                log.info("⚠️ Decryption already exists for guardian {} and chunk {}, skipping save",
                         message.getGuardianId(), message.getChunkId());
            }
            
            // Increment progress
            incrementProcessedChunks(message.getJobId());
            
            // CRITICAL: Clear Hibernate session to release memory
            // Note: No flush() needed - incrementProcessedChunks() has its own @Transactional
            entityManager.clear();
            
            // Clear references
            submittedBallots.clear();
            submittedBallotCipherTexts.clear();
            submittedBallots = null;
            submittedBallotCipherTexts = null;
            response = null;
            
            // Suggest GC
            System.gc();
            
            // Log memory after
            long memoryAfter = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            log.info("✅ Chunk {} completed successfully", message.getChunkId());
            log.info("🧠 Memory after chunk: {} MB (freed {} MB)", 
                     memoryAfter, memoryBefore - memoryAfter);
            
        } catch (Exception e) {
            log.error("❌ Failed to process decryption chunk {}: {}", 
                      message.getChunkId(), e.getMessage(), e);
            incrementFailedChunks(message.getJobId());
            
            // Clear memory even on failure
            entityManager.clear();
            
            // Rethrow to trigger message requeue
            throw new RuntimeException("Decryption chunk processing failed", e);
        }
    }
    
    /**
     * Call ElectionGuard service for partial decryption
     */
    private ElectionGuardPartialDecryptionResponse callElectionGuardPartialDecryptionService(
            DecryptionMetadata metadata, String encryptedTally, List<String> submittedBallots) {
        
        try {
            ElectionGuardPartialDecryptionRequest request = ElectionGuardPartialDecryptionRequest.builder()
                    .ciphertext_tally(encryptedTally)
                    .submitted_ballots(submittedBallots)
                    .private_key(metadata.getGuardianPrivateKey())
                    .guardian_id(String.valueOf(metadata.getGuardianSequenceOrder()))
                    .party_names(metadata.getPartyNames())
                    .candidate_names(metadata.getCandidateNames())
                    .commitment_hash(metadata.getBaseHash())
                    .quorum(metadata.getQuorum())
                    .number_of_guardians(metadata.getNumberOfGuardians())
                    .build();
            
            String responseJson = electionGuardService.postRequest("/api/partial_decrypt", request);
            return objectMapper.readValue(responseJson, ElectionGuardPartialDecryptionResponse.class);
            
        } catch (Exception e) {
            log.error("ElectionGuard partial decryption service call failed: {}", e.getMessage());
            throw new RuntimeException("ElectionGuard service error", e);
        }
    }
    
    /**
     * Increment processed chunks counter (separate transaction)
     */
    @Transactional
    private void incrementProcessedChunks(java.util.UUID jobId) {
        ElectionJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new RuntimeException("Job not found"));
        job.incrementProcessed();
        jobRepository.save(job);
    }
    
    /**
     * Increment failed chunks counter (separate transaction)
     */
    @Transactional
    private void incrementFailedChunks(java.util.UUID jobId) {
        try {
            ElectionJob job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new RuntimeException("Job not found"));
            job.incrementFailed();
            jobRepository.save(job);
        } catch (Exception e) {
            log.error("Failed to increment failed chunks: {}", e.getMessage());
        }
    }
    
    /**
     * Metadata stored in job record
     */
    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class DecryptionMetadata {
        private String guardianPrivateKey;
        private int guardianSequenceOrder;
        private List<String> partyNames;
        private List<String> candidateNames;
        private String baseHash;
        private int quorum;
        private int numberOfGuardians;
    }
}
