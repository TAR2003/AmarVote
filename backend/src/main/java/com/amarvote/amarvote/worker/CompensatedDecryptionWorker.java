package com.amarvote.amarvote.worker;

import java.util.List;
import java.util.Optional;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionResponse;
import com.amarvote.amarvote.dto.queue.CompensatedDecryptionMessage;
import com.amarvote.amarvote.dto.queue.OperationType;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.service.ElectionGuardService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Worker that processes compensated decryption messages from RabbitMQ
 * 
 * COMPENSATED DECRYPTION FLOW:
 * - Guardian A creates compensated shares for missing Guardian B
 * - Each chunk requires Guardian A's data + Guardian B's public key
 * - This allows the system to compute shares as if Guardian B participated
 * 
 * MEMORY-EFFICIENT DESIGN:
 * - Processes ONE chunk at a time
 * - Loads only data for that specific chunk
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
public class CompensatedDecryptionWorker {

    private final ElectionJobRepository jobRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final GuardianRepository guardianRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final ElectionGuardService electionGuardService;
    private final ObjectMapper objectMapper;
    
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Listen to compensated decryption queue and process one chunk at a time
     * 
     * @RabbitListener automatically:
     * - Fetches one message from queue (prefetchCount=1)
     * - Acknowledges message on success
     * - Requeues message on failure (for retry)
     * 
     * NOTE: No @Transactional here - RabbitMQ listeners manage their own message transactions.
     * Database operations are in separate @Transactional methods.
     */
    @RabbitListener(queues = RabbitMQConfig.COMPENSATED_DECRYPTION_QUEUE)
    public void processCompensatedDecryptionChunk(CompensatedDecryptionMessage message) {
        log.info("=== Compensated Decryption Worker Processing Chunk ===");
        log.info("Job ID: {}, Chunk ID: {}, Election ID: {}, Source Guardian: {}, Missing Guardian: {}", 
                 message.getJobId(), message.getChunkId(), message.getElectionId(),
                 message.getSourceGuardianId(), message.getMissingGuardianId());
        
        // Track memory before processing
        Runtime runtime = Runtime.getRuntime();
        long memoryBefore = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        log.info("🧠 Memory before chunk: {} MB", memoryBefore);
        
        try {
            // Validate message
            if (message.getOperationType() != OperationType.COMPENSATED_DECRYPTION) {
                throw new IllegalArgumentException("Invalid operation type: " + message.getOperationType());
            }
            
            // Load job to get metadata
            Optional<ElectionJob> jobOpt = jobRepository.findById(message.getJobId());
            if (jobOpt.isEmpty()) {
                throw new RuntimeException("Job not found: " + message.getJobId());
            }
            
            ElectionJob job = jobOpt.get();
            
            // Parse metadata (contains guardian credentials and parameters)
            CompensatedDecryptionMetadata metadata = objectMapper.readValue(
                job.getMetadata(), CompensatedDecryptionMetadata.class);
            
            // Load guardians
            Optional<Guardian> sourceGuardianOpt = guardianRepository.findById(message.getSourceGuardianId());
            Optional<Guardian> missingGuardianOpt = guardianRepository.findById(message.getMissingGuardianId());
            
            if (sourceGuardianOpt.isEmpty() || missingGuardianOpt.isEmpty()) {
                throw new RuntimeException("Guardian not found");
            }
            
            Guardian sourceGuardian = sourceGuardianOpt.get();
            Guardian missingGuardian = missingGuardianOpt.get();
            
            log.info("✅ Loaded guardians - Source: {}, Missing: {}", 
                    sourceGuardian.getUserEmail(), missingGuardian.getUserEmail());
            
            // Load election center for THIS chunk only (memory efficient)
            Optional<ElectionCenter> electionCenterOpt = electionCenterRepository.findById(message.getChunkId());
            if (electionCenterOpt.isEmpty()) {
                throw new RuntimeException("Election center not found: " + message.getChunkId());
            }
            
            ElectionCenter electionCenter = electionCenterOpt.get();
            log.info("✅ Loaded election center: {}", message.getChunkId());
            
            // Load submitted ballots for THIS chunk only
            List<SubmittedBallot> chunkBallots = submittedBallotRepository.findByElectionCenterId(message.getChunkId());
            List<String> ballotCipherTexts = chunkBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .filter(ct -> ct != null && !ct.trim().isEmpty())
                .toList();
            
            log.info("✅ Loaded {} ballot cipher texts", ballotCipherTexts.size());
            
            // Call ElectionGuard microservice to generate compensated shares
            ElectionGuardCompensatedDecryptionRequest request = ElectionGuardCompensatedDecryptionRequest.builder()
                .available_guardian_id(String.valueOf(sourceGuardian.getSequenceOrder()))
                .missing_guardian_id(String.valueOf(missingGuardian.getSequenceOrder()))
                .available_private_key(metadata.getDecryptedPrivateKey())
                .available_public_key(sourceGuardian.getGuardianPublicKey())
                .available_polynomial(metadata.getDecryptedPolynomial())
                .party_names(metadata.getPartyNames())
                .candidate_names(metadata.getCandidateNames())
                .ciphertext_tally(electionCenter.getEncryptedTally())
                .submitted_ballots(ballotCipherTexts)
                .joint_public_key(metadata.getJointPublicKey())
                .commitment_hash(metadata.getBaseHash())
                .number_of_guardians(metadata.getNumberOfGuardians())
                .quorum(metadata.getQuorum())
                .build();
            
            log.info("⏳ Calling ElectionGuard microservice for compensated decryption...");
            ElectionGuardCompensatedDecryptionResponse response = 
                callElectionGuardCompensatedDecryptionService(request);
            
            if (response == null || response.compensated_tally_share() == null) {
                throw new RuntimeException("Failed to generate compensated decryption shares");
            }
            
            log.info("✅ Microservice call completed successfully");
            
            // Save compensated decryption to database
            CompensatedDecryption compensatedDecryption = CompensatedDecryption.builder()
                .electionCenterId(message.getChunkId())
                .compensatingGuardianId(sourceGuardian.getGuardianId())
                .missingGuardianId(missingGuardian.getGuardianId())
                .compensatedTallyShare(response.compensated_tally_share())
                .compensatedBallotShare(response.compensated_ballot_shares())
                .build();
            
            saveCompensatedDecryption(compensatedDecryption);
            
            log.info("✅ Saved compensated decryption to database");
            
            // Update job progress
            incrementJobProgress(message.getJobId());
            
            // Clear EntityManager to free memory
            entityManager.clear();
            
            // Log memory after processing
            long memoryAfter = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
            long memoryUsed = memoryAfter - memoryBefore;
            log.info("🧠 Memory after chunk: {} MB (used {} MB)", memoryAfter, memoryUsed);
            log.info("✅ Compensated decryption chunk processed successfully");
            
        } catch (Exception e) {
            log.error("❌ Error processing compensated decryption chunk: {}", e.getMessage(), e);
            
            // Mark job as failed
            try {
                markJobChunkFailed(message.getJobId());
            } catch (Exception updateError) {
                log.error("Failed to update job failure status: {}", updateError.getMessage());
            }
            
            // Re-throw to trigger RabbitMQ retry
            throw new RuntimeException("Failed to process compensated decryption chunk", e);
        }
    }

    /**
     * Save compensated decryption in separate transaction
     */
    @Transactional
    public void saveCompensatedDecryption(CompensatedDecryption compensatedDecryption) {
        compensatedDecryptionRepository.save(compensatedDecryption);
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
                log.info("🎉 All compensated decryption chunks completed for job {}", jobId);
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
     * Metadata class for compensated decryption job parameters
     */
    public static class CompensatedDecryptionMetadata {
        private String decryptedPrivateKey;
        private String decryptedPolynomial;
        private List<String> candidateNames;
        private List<String> partyNames;
        private String jointPublicKey;
        private String baseHash;
        private Integer numberOfGuardians;
        private Integer quorum;

        // Getters and setters
        public String getDecryptedPrivateKey() { return decryptedPrivateKey; }
        public void setDecryptedPrivateKey(String decryptedPrivateKey) { this.decryptedPrivateKey = decryptedPrivateKey; }
        
        public String getDecryptedPolynomial() { return decryptedPolynomial; }
        public void setDecryptedPolynomial(String decryptedPolynomial) { this.decryptedPolynomial = decryptedPolynomial; }
        
        public List<String> getCandidateNames() { return candidateNames; }
        public void setCandidateNames(List<String> candidateNames) { this.candidateNames = candidateNames; }
        
        public List<String> getPartyNames() { return partyNames; }
        public void setPartyNames(List<String> partyNames) { this.partyNames = partyNames; }
        
        public String getJointPublicKey() { return jointPublicKey; }
        public void setJointPublicKey(String jointPublicKey) { this.jointPublicKey = jointPublicKey; }
        
        public String getBaseHash() { return baseHash; }
        public void setBaseHash(String baseHash) { this.baseHash = baseHash; }
        
        public Integer getNumberOfGuardians() { return numberOfGuardians; }
        public void setNumberOfGuardians(Integer numberOfGuardians) { this.numberOfGuardians = numberOfGuardians; }
        
        public Integer getQuorum() { return quorum; }
        public void setQuorum(Integer quorum) { this.quorum = quorum; }
    }

    /**
     * Call ElectionGuard microservice for compensated decryption
     */
    private ElectionGuardCompensatedDecryptionResponse callElectionGuardCompensatedDecryptionService(
            ElectionGuardCompensatedDecryptionRequest request) {
        try {
            String url = "/create_compensated_decryption";
            String response = electionGuardService.postRequest(url, request);
            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }
            
            return objectMapper.readValue(response, ElectionGuardCompensatedDecryptionResponse.class);
        } catch (Exception e) {
            log.error("Error calling ElectionGuard compensated decryption service: {}", e.getMessage(), e);
            return null;
        }
    }
}
