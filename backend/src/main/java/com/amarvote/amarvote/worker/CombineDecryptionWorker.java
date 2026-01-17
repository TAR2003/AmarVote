package com.amarvote.amarvote.worker;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesRequest;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesResponse;
import com.amarvote.amarvote.dto.queue.ChunkMessage;
import com.amarvote.amarvote.dto.queue.OperationType;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.amarvote.amarvote.service.ElectionGuardService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Worker that processes combine decryption shares messages from RabbitMQ
 * 
 * COMBINE DECRYPTION FLOW:
 * - Collects all partial decryption shares from guardians
 * - Collects compensated shares for missing guardians
 * - Combines them to produce final decrypted tally
 * - Stores the plaintext results
 * 
 * MEMORY-EFFICIENT DESIGN:
 * - Processes ONE chunk at a time
 * - Loads only shares for that specific chunk
 * - Clears EntityManager after each chunk
 * - Each worker uses ~100-150 MB regardless of total chunks
 * 
 * SCALING:
 * - Multiple workers can process different chunks concurrently
 * - Horizontal scaling: docker-compose up -d --scale backend=10
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CombineDecryptionWorker {

    private final ElectionJobRepository jobRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final DecryptionRepository decryptionRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final ElectionGuardService electionGuardService;
    private final ObjectMapper objectMapper;
    
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Listen to combine decryption queue and process one chunk at a time
     * 
     * @RabbitListener automatically:
     * - Fetches one message from queue (prefetchCount=1)
     * - Acknowledges message on success
     * - Requeues message on failure (for retry)
     * 
     * NOTE: No @Transactional here - RabbitMQ listeners manage their own message transactions.
     * Database operations are in separate @Transactional methods.
     */
    @RabbitListener(queues = RabbitMQConfig.COMBINE_QUEUE)
    public void processCombineChunk(ChunkMessage message) {
        log.info("=== Combine Decryption Worker Processing Chunk ===");
        log.info("Job ID: {}, Chunk ID: {}, Election ID: {}", 
                 message.getJobId(), message.getChunkId(), message.getElectionId());
        
        // Track memory before processing
        Runtime runtime = Runtime.getRuntime();
        long memoryBefore = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        log.info("🧠 Memory before chunk: {} MB", memoryBefore);
        
        try {
            // Validate message
            if (message.getOperationType() != OperationType.COMBINE) {
                throw new IllegalArgumentException("Invalid operation type: " + message.getOperationType());
            }
            
            // Load job to get metadata
            Optional<ElectionJob> jobOpt = jobRepository.findById(message.getJobId());
            if (jobOpt.isEmpty()) {
                throw new RuntimeException("Job not found: " + message.getJobId());
            }
            
            ElectionJob job = jobOpt.get();
            
            // Parse metadata (contains election parameters)
            CombineMetadata metadata = objectMapper.readValue(job.getMetadata(), CombineMetadata.class);
            
            // Load election center for THIS chunk only (memory efficient)
            Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(message.getChunkId());
            if (electionCenterOpt.isEmpty()) {
                throw new RuntimeException("Election center not found: " + message.getChunkId());
            }
            
            ElectionCenter electionCenter = electionCenterOpt.get();
            log.info("✅ Loaded election center: {}", message.getChunkId());
            
            // Load ALL partial decryption shares for THIS chunk
            List<Decryption> decryptions = decryptionRepository.findByElectionCenterId(message.getChunkId());
            log.info("✅ Loaded {} partial decryption shares", decryptions.size());
            
            // Load ALL compensated shares for THIS chunk
            List<CompensatedDecryption> compensatedDecryptions = 
                compensatedDecryptionRepository.findByElectionCenterId(message.getChunkId());
            log.info("✅ Loaded {} compensated decryption shares", compensatedDecryptions.size());
            
            // Validate we have enough shares (must meet quorum)
            int totalShares = decryptions.size() + compensatedDecryptions.size();
            if (totalShares < metadata.getQuorum()) {
                throw new RuntimeException(String.format(
                    "Insufficient shares for combining. Need %d, have %d (partial: %d, compensated: %d)",
                    metadata.getQuorum(), totalShares, decryptions.size(), compensatedDecryptions.size()));
            }
            
            log.info("✅ Validation passed - have {} shares (quorum: {})", totalShares, metadata.getQuorum());
            
            // Prepare shares for combining
            List<String> tallyShares = decryptions.stream()
                .map(Decryption::getTallyShare)
                .collect(Collectors.toList());
            
            List<String> ballotShares = decryptions.stream()
                .map(Decryption::getPartialDecryptedTally)
                .collect(Collectors.toList());
            
            // Add compensated shares
            tallyShares.addAll(compensatedDecryptions.stream()
                .map(CompensatedDecryption::getCompensatedTallyShare)
                .collect(Collectors.toList()));
            
            ballotShares.addAll(compensatedDecryptions.stream()
                .map(CompensatedDecryption::getCompensatedBallotShare)
                .collect(Collectors.toList()));
            
            log.info("✅ Prepared {} tally shares and {} ballot shares for combining", 
                    tallyShares.size(), ballotShares.size());
            
            // Call ElectionGuard microservice to combine shares
            ElectionGuardCombineDecryptionSharesRequest request = ElectionGuardCombineDecryptionSharesRequest.builder()
                .party_names(metadata.getPartyNames())
                .candidate_names(metadata.getCandidateNames())
                .joint_public_key(metadata.getJointPublicKey())
                .commitment_hash(metadata.getBaseHash())
                .ciphertext_tally(electionCenter.getEncryptedTally())
                .available_tally_shares(tallyShares)
                .available_ballot_shares(ballotShares)
                .quorum(metadata.getQuorum())
                .build();
            
            log.info("⏳ Calling ElectionGuard microservice to combine shares...");
            ElectionGuardCombineDecryptionSharesResponse response = 
                callElectionGuardCombineDecryptionSharesService(request);
            
            if (response == null || response.results() == null) {
                throw new RuntimeException("Failed to combine decryption shares");
            }
            
            log.info("✅ Microservice call completed successfully");
            
            // Update election center with decrypted results
            updateElectionCenterWithResults(message.getChunkId(), response.results());
            
            log.info("✅ Updated election center with decrypted results");
            
            // Update job progress
            incrementJobProgress(message.getJobId());
            
            // Clear EntityManager to free memory
            entityManager.clear();
            
            // Log memory after processing
            long memoryAfter = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            long memoryUsed = memoryAfter - memoryBefore;
            log.info("🧠 Memory after chunk: {} MB (used {} MB)", memoryAfter, memoryUsed);
            log.info("✅ Combine decryption chunk processed successfully");
            
        } catch (Exception e) {
            log.error("❌ Error processing combine decryption chunk: {}", e.getMessage(), e);
            
            // Mark job as failed
            try {
                markJobChunkFailed(message.getJobId());
            } catch (Exception updateError) {
                log.error("Failed to update job failure status: {}", updateError.getMessage());
            }
            
            // Re-throw to trigger RabbitMQ retry
            throw new RuntimeException("Failed to process combine decryption chunk", e);
        }
    }

    /**
     * Update election center with decrypted results in separate transaction
     */
    @Transactional
    public void updateElectionCenterWithResults(Long electionCenterId, String results) {
        Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(electionCenterId);
        if (electionCenterOpt.isPresent()) {
            ElectionCenter electionCenter = electionCenterOpt.get();
            electionCenter.setElectionResult(results);
            electionCenterRepository.save(electionCenter);
        }
    }

    /**
     * Increment job progress in separate transaction
     */
    @Transactional
    public void incrementJobProgress(java.util.UUID jobId) {
        Optional<ElectionJob> jobOpt = jobRepository.findById(jobId);
        if (jobOpt.isPresent()) {
            ElectionJob job = jobOpt.get();
            job.setProcessedChunks(job.getProcessedChunks() + 1);
            
            // Check if all chunks are complete
            if (job.getProcessedChunks() >= job.getTotalChunks()) {
                job.setStatus("COMPLETED");
                job.setCompletedAt(java.time.Instant.now());
                log.info("🎉 All combine decryption chunks completed for job {}", jobId);
            }
            
            jobRepository.save(job);
        }
    }

    /**
     * Mark job chunk as failed in separate transaction
     */
    @Transactional
    public void markJobChunkFailed(java.util.UUID jobId) {
        Optional<ElectionJob> jobOpt = jobRepository.findById(jobId);
        if (jobOpt.isPresent()) {
            ElectionJob job = jobOpt.get();
            job.setFailedChunks(job.getFailedChunks() + 1);
            job.setStatus("FAILED");
            jobRepository.save(job);
        }
    }

    /**
     * Metadata class for combine job parameters
     */
    public static class CombineMetadata {
        private List<String> candidateNames;
        private List<String> partyNames;
        private String jointPublicKey;
        private String baseHash;
        private Integer quorum;

        // Getters and setters
        public List<String> getCandidateNames() { return candidateNames; }
        public void setCandidateNames(List<String> candidateNames) { this.candidateNames = candidateNames; }
        
        public List<String> getPartyNames() { return partyNames; }
        public void setPartyNames(List<String> partyNames) { this.partyNames = partyNames; }
        
        public String getJointPublicKey() { return jointPublicKey; }
        public void setJointPublicKey(String jointPublicKey) { this.jointPublicKey = jointPublicKey; }
        
        public String getBaseHash() { return baseHash; }
        public void setBaseHash(String baseHash) { this.baseHash = baseHash; }
        
        public Integer getQuorum() { return quorum; }
        public void setQuorum(Integer quorum) { this.quorum = quorum; }
    }

    /**
     * Call ElectionGuard microservice to combine decryption shares
     */
    private ElectionGuardCombineDecryptionSharesResponse callElectionGuardCombineDecryptionSharesService(
            ElectionGuardCombineDecryptionSharesRequest request) {
        try {
            String url = "/combine_decryption_shares";
            String response = electionGuardService.postRequest(url, request);
            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }
            
            return objectMapper.readValue(response, ElectionGuardCombineDecryptionSharesResponse.class);
        } catch (Exception e) {
            log.error("Error calling ElectionGuard combine decryption service: {}", e.getMessage(), e);
            return null;
        }
    }
}
