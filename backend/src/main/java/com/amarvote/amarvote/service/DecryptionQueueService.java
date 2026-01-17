package com.amarvote.amarvote.service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.queue.JobResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.worker.DecryptionWorker;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service for creating partial decryption using message queue
 * 
 * This replaces the synchronous partial decryption with queue-based processing:
 * 1. Validates guardian and tally existence
 * 2. Decrypts guardian credentials
 * 3. Publishes chunk IDs to RabbitMQ
 * 4. Returns immediately with job ID
 * 5. Workers process chunks in background
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DecryptionQueueService {

    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final GuardianRepository guardianRepository;
    private final QueuePublisherService queuePublisherService;
    private final ElectionGuardCryptoService cryptoService;
    private final ObjectMapper objectMapper;

    /**
     * Create partial decryption using message queue
     * 
     * This method:
     * 1. Validates guardian and election
     * 2. Checks tally exists
     * 3. Decrypts guardian credentials
     * 4. Publishes chunk IDs to queue
     * 5. Returns immediately with job ID
     * 
     * Workers then process each chunk independently
     */
    @Transactional
    public JobResponse createPartialDecryptionAsync(CreatePartialDecryptionRequest request, String userEmail) {
        
        log.info("=== Creating Partial Decryption (Queue Mode) ===");
        log.info("Election ID: {}, User: {}", request.election_id(), userEmail);
        
        // 1. Find guardian record for this user and election
        List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(request.election_id(), userEmail);
        if (guardians.isEmpty()) {
            throw new RuntimeException("User is not a guardian for this election");
        }
        Guardian guardian = guardians.get(0);
        
        // 2. Get election information
        Optional<Election> electionOpt = electionRepository.findById(request.election_id());
        if (!electionOpt.isPresent()) {
            throw new RuntimeException("Election not found");
        }
        Election election = electionOpt.get();
        
        // 3. Check if encrypted tally exists
        List<Long> electionCenterIds = electionCenterRepository
                .findElectionCenterIdsByElectionId(request.election_id());
        
        log.info("=== TALLY VERIFICATION ===");
        log.info("Found {} chunk(s) in election_center table", electionCenterIds.size());
        
        if (electionCenterIds.isEmpty()) {
            log.error("❌ NO ENCRYPTED TALLY FOUND");
            throw new RuntimeException("Tally has not been created yet. Please create the tally before submitting guardian keys.");
        }
        
        log.info("✅ TALLY EXISTS - PROCEEDING WITH GUARDIAN KEY SUBMISSION");
        
        // 4. Decrypt guardian credentials
        String guardianCredentials = guardian.getCredentials();
        if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
            throw new RuntimeException("Guardian credentials not found. Please contact the administrator.");
        }

        String decryptedPrivateKey;
        String decryptedPolynomial;
        try {
            log.info("Decrypting guardian credentials...");
            ElectionGuardCryptoService.GuardianDecryptionResult decryptionResult = 
                    cryptoService.decryptGuardianData(request.encrypted_data(), guardianCredentials);
            decryptedPrivateKey = decryptionResult.getPrivateKey();
            decryptedPolynomial = decryptionResult.getPolynomial();
            log.info("✅ Successfully decrypted guardian credentials");
        } catch (Exception e) {
            log.error("Failed to decrypt guardian credentials: {}", e.getMessage());
            throw new RuntimeException("Failed to decrypt guardian credentials. Please ensure you uploaded the correct credential file.");
        }
        
        // 5. Get election choices for candidate and party names
        List<ElectionChoice> choices = electionChoiceRepository
                .findByElectionIdOrderByChoiceIdAsc(request.election_id());
        List<String> candidateNames = choices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
        List<String> partyNames = choices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
        
        // 6. Get number of guardians for this election
        List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
        int numberOfGuardians = allGuardians.size();
        
        // 7. Prepare metadata for workers
        DecryptionWorker.DecryptionMetadata metadata = new DecryptionWorker.DecryptionMetadata();
        metadata.setGuardianId(guardian.getGuardianId());
        metadata.setGuardianSequenceOrder(guardian.getSequenceOrder());
        metadata.setDecryptedPrivateKey(decryptedPrivateKey);
        metadata.setDecryptedPolynomial(decryptedPolynomial);
        metadata.setGuardianPublicKey(guardian.getGuardianPublicKey());
        metadata.setPartyNames(partyNames);
        metadata.setCandidateNames(candidateNames);
        metadata.setJointPublicKey(election.getJointPublicKey());
        metadata.setBaseHash(election.getBaseHash());
        metadata.setNumberOfGuardians(numberOfGuardians);
        metadata.setQuorum(election.getElectionQuorum());
        
        String metadataJson;
        try {
            metadataJson = objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize metadata", e);
        }
        
        // 8. Publish job to queue
        JobResponse response = queuePublisherService.publishDecryptionJob(
                request.election_id(),
                guardian.getGuardianId(),
                electionCenterIds,
                metadataJson,
                userEmail
        );
        
        log.info("✅ Partial decryption job published: {}", response.getJobId());
        log.info("📊 Poll URL: {}", response.getPollUrl());
        
        return response;
    }
}
