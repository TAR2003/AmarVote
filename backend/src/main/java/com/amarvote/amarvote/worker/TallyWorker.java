package com.amarvote.amarvote.worker;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.ElectionGuardTallyRequest;
import com.amarvote.amarvote.dto.ElectionGuardTallyResponse;
import com.amarvote.amarvote.dto.queue.ChunkMessage;
import com.amarvote.amarvote.dto.queue.OperationType;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.BallotRepository;
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
 * Worker that processes tally creation messages from RabbitMQ
 * 
 * MEMORY-EFFICIENT DESIGN:
 * - Processes ONE chunk at a time
 * - Loads only ballots for that chunk
 * - Clears EntityManager after each chunk
 * - Each worker uses ~150-200 MB regardless of total chunks
 * 
 * SCALING:
 * - Start 1 worker: docker-compose up -d
 * - Scale to 10 workers: docker-compose up -d --scale backend=10
 * - Scale to 100 workers: docker-compose up -d --scale backend=100
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TallyWorker {

    private final ElectionJobRepository jobRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final BallotRepository ballotRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final ElectionGuardService electionGuardService;
    private final ObjectMapper objectMapper;
    
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Listen to tally queue and process one chunk at a time
     * 
     * @RabbitListener automatically:
     * - Fetches one message from queue (prefetchCount=1)
     * - Acknowledges message on success
     * - Requeues message on failure (for retry)
     * 
     * NOTE: No @Transactional here - RabbitMQ listeners manage their own message transactions.
     * Database operations are in separate @Transactional methods (incrementProcessedChunks).
     */
    @RabbitListener(queues = RabbitMQConfig.TALLY_QUEUE)
    public void processTallyChunk(ChunkMessage message) {
        log.info("=== Tally Worker Processing Chunk ===");
        log.info("Job ID: {}, Chunk ID: {}, Election ID: {}", 
                 message.getJobId(), message.getChunkId(), message.getElectionId());
        
        // Track memory before processing
        Runtime runtime = Runtime.getRuntime();
        long memoryBefore = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        log.info("🧠 Memory before chunk: {} MB", memoryBefore);
        
        try {
            // Validate message
            if (message.getOperationType() != OperationType.TALLY) {
                throw new IllegalArgumentException("Invalid operation type: " + message.getOperationType());
            }
            
            // Load job to get metadata
            Optional<ElectionJob> jobOpt = jobRepository.findById(message.getJobId());
            if (jobOpt.isEmpty()) {
                throw new RuntimeException("Job not found: " + message.getJobId());
            }
            
            ElectionJob job = jobOpt.get();
            
            // Parse metadata (contains election parameters)
            TallyMetadata metadata = objectMapper.readValue(job.getMetadata(), TallyMetadata.class);
            
            // Load ballots for THIS chunk only (memory efficient)
            // Note: We need to assign ballots to this election center
            // For now, we'll query all ballots and filter by chunk
            List<Long> allBallotIds = ballotRepository.findBallotIdsByElectionIdAndStatus(
                    message.getElectionId(), "cast");
            
            // Calculate which ballots belong to this chunk
            // This is a simplified approach - in production you'd store the mapping
            int chunkSize = (int) Math.ceil(allBallotIds.size() / (double) job.getTotalChunks());
            int chunkIndex = findChunkIndex(message.getChunkId(), job.getTotalChunks());
            int startIdx = chunkIndex * chunkSize;
            int endIdx = Math.min(startIdx + chunkSize, allBallotIds.size());
            
            List<Long> chunkBallotIds = allBallotIds.subList(startIdx, endIdx);
            
            log.info("✅ Processing ballots {} to {} (total: {})", 
                     startIdx, endIdx - 1, chunkBallotIds.size());
            
            if (chunkBallotIds.isEmpty()) {
                log.warn("⚠️ No ballots assigned to chunk {}", message.getChunkId());
                incrementProcessedChunks(message.getJobId());
                return;
            }
            
            List<Ballot> chunkBallots = ballotRepository.findByBallotIdIn(chunkBallotIds);
            
            // Extract cipher texts
            List<String> encryptedBallots = chunkBallots.stream()
                    .map(Ballot::getCipherText)
                    .collect(Collectors.toList());
            
            // Call ElectionGuard service
            ElectionGuardTallyResponse response = callElectionGuardTallyService(
                    metadata, encryptedBallots);
            
            if (!"success".equals(response.getStatus())) {
                throw new RuntimeException("ElectionGuard service failed: " + response.getStatus());
            }
            
            // Save encrypted tally to ElectionCenter
            ElectionCenter center = electionCenterRepository.findById(message.getChunkId())
                    .orElseThrow(() -> new RuntimeException("ElectionCenter not found: " + message.getChunkId()));
            
            center.setEncryptedTally(response.getCiphertext_tally());
            electionCenterRepository.save(center);
            
            // Save submitted ballots
            if (response.getSubmitted_ballots() != null) {
                for (String submittedBallotCipherText : response.getSubmitted_ballots()) {
                    if (!submittedBallotRepository.existsByElectionCenterIdAndCipherText(
                            center.getElectionCenterId(), submittedBallotCipherText)) {
                        SubmittedBallot submittedBallot = SubmittedBallot.builder()
                                .electionCenterId(center.getElectionCenterId())
                                .cipherText(submittedBallotCipherText)
                                .build();
                        submittedBallotRepository.save(submittedBallot);
                    }
                }
            }
            
            // Increment progress
            incrementProcessedChunks(message.getJobId());
            
            // CRITICAL: Clear Hibernate session to release memory
            // Note: No flush() needed - incrementProcessedChunks() has its own @Transactional
            entityManager.clear();
            
            // Clear references
            chunkBallots.clear();
            encryptedBallots.clear();
            chunkBallots = null;
            encryptedBallots = null;
            response = null;
            
            // Suggest GC
            System.gc();
            
            // Log memory after
            long memoryAfter = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            log.info("✅ Chunk {} completed successfully", message.getChunkId());
            log.info("🧠 Memory after chunk: {} MB (freed {} MB)", 
                     memoryAfter, memoryBefore - memoryAfter);
            
        } catch (Exception e) {
            log.error("❌ Failed to process chunk {}: {}", message.getChunkId(), e.getMessage(), e);
            incrementFailedChunks(message.getJobId());
            
            // Clear memory even on failure
            entityManager.clear();
            
            // Rethrow to trigger message requeue
            throw new RuntimeException("Chunk processing failed", e);
        }
    }
    
    /**
     * Call ElectionGuard service to create tally
     */
    private ElectionGuardTallyResponse callElectionGuardTallyService(
            TallyMetadata metadata, List<String> encryptedBallots) {
        
        try {
            ElectionGuardTallyRequest request = ElectionGuardTallyRequest.builder()
                    .party_names(metadata.getPartyNames())
                    .candidate_names(metadata.getCandidateNames())
                    .joint_public_key(metadata.getJointPublicKey())
                    .commitment_hash(metadata.getBaseHash())
                    .encrypted_ballots(encryptedBallots)
                    .quorum(metadata.getQuorum())
                    .number_of_guardians(metadata.getNumberOfGuardians())
                    .build();
            
            String responseJson = electionGuardService.postRequest("/api/tally", request);
            return objectMapper.readValue(responseJson, ElectionGuardTallyResponse.class);
            
        } catch (Exception e) {
            log.error("ElectionGuard service call failed: {}", e.getMessage());
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
    
    /**     * Find chunk index for this election center ID
     */
    private int findChunkIndex(Long electionCenterId, int totalChunks) {
        // Simple hash-based distribution
        return (int) (electionCenterId % totalChunks);
    }
    
    /**     * Metadata stored in job record
     */
    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class TallyMetadata {
        private List<String> partyNames;
        private List<String> candidateNames;
        private String jointPublicKey;
        private String baseHash;
        private int quorum;
        private int numberOfGuardians;
    }
}
