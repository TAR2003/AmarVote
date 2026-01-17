package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.queue.JobResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.worker.CompensatedDecryptionWorker;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service for creating compensated decryption using message queue
 * 
 * This replaces the synchronous compensated decryption with queue-based processing:
 * 1. Validates guardian and tally existence
 * 2. Finds missing guardians
 * 3. Publishes (chunk, source_guardian, missing_guardian) messages to RabbitMQ
 * 4. Returns immediately with job ID
 * 5. Workers process each combination in background
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompensatedDecryptionQueueService {

    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final GuardianRepository guardianRepository;
    private final QueuePublisherService queuePublisherService;
    private final ObjectMapper objectMapper;

    /**
     * Create compensated decryption shares using message queue
     * 
     * This method:
     * 1. Validates election and guardian
     * 2. Finds missing guardians
     * 3. For each missing guardian, publishes chunk IDs to queue
     * 4. Returns immediately with job IDs
     * 
     * Workers then process each (chunk, source, missing) combination independently
     */
    @Transactional
    public List<JobResponse> createCompensatedDecryptionAsync(
            Long electionId, Long sourceGuardianId, String decryptedPrivateKey, 
            String decryptedPolynomial, String userEmail) {
        
        log.info("=== Creating Compensated Decryption (Queue Mode) ===");
        log.info("Election ID: {}, Source Guardian ID: {}", electionId, sourceGuardianId);
        
        // 1. Get election information
        Optional<Election> electionOpt = electionRepository.findById(electionId);
        if (!electionOpt.isPresent()) {
            throw new RuntimeException("Election not found");
        }
        Election election = electionOpt.get();
        
        // 2. Get election center IDs (chunks)
        List<Long> electionCenterIds = electionCenterRepository
                .findElectionCenterIdsByElectionId(electionId);
        
        if (electionCenterIds.isEmpty()) {
            throw new RuntimeException("No tally chunks found for this election");
        }
        
        log.info("✅ Found {} tally chunks", electionCenterIds.size());
        
        // 3. Get all guardians
        List<Guardian> allGuardians = guardianRepository.findByElectionId(electionId);
        
        // 4. Find source guardian
        Optional<Guardian> sourceGuardianOpt = allGuardians.stream()
                .filter(g -> g.getGuardianId().equals(sourceGuardianId))
                .findFirst();
        
        if (!sourceGuardianOpt.isPresent()) {
            throw new RuntimeException("Source guardian not found");
        }
        Guardian sourceGuardian = sourceGuardianOpt.get();
        
        // 5. Find other guardians (potential missing guardians to compensate for)
        List<Guardian> otherGuardians = allGuardians.stream()
                .filter(g -> !g.getGuardianId().equals(sourceGuardianId))
                .collect(Collectors.toList());
        
        log.info("✅ Found {} other guardians to create compensated shares for", otherGuardians.size());
        
        // 6. Get election choices for metadata
        List<ElectionChoice> choices = electionChoiceRepository
                .findByElectionIdOrderByChoiceIdAsc(electionId);
        List<String> candidateNames = choices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
        List<String> partyNames = choices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
        
        // 7. Prepare metadata
        CompensatedDecryptionWorker.CompensatedDecryptionMetadata metadata = 
                new CompensatedDecryptionWorker.CompensatedDecryptionMetadata();
        metadata.setDecryptedPrivateKey(decryptedPrivateKey);
        metadata.setDecryptedPolynomial(decryptedPolynomial);
        metadata.setCandidateNames(candidateNames);
        metadata.setPartyNames(partyNames);
        metadata.setJointPublicKey(election.getJointPublicKey());
        metadata.setBaseHash(election.getBaseHash());
        metadata.setNumberOfGuardians(allGuardians.size());
        metadata.setQuorum(election.getElectionQuorum());
        
        String metadataJson;
        try {
            metadataJson = objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize metadata", e);
        }
        
        // 8. Publish jobs to queue - one job per missing guardian
        List<JobResponse> jobResponses = new ArrayList<>();
        
        for (Guardian missingGuardian : otherGuardians) {
            log.info("📤 Publishing compensated decryption job for missing guardian {}", 
                     missingGuardian.getSequenceOrder());
            
            JobResponse response = queuePublisherService.publishCompensatedDecryptionJob(
                    electionId,
                    sourceGuardianId,
                    missingGuardian.getGuardianId(),
                    electionCenterIds,
                    metadataJson,
                    userEmail
            );
            
            jobResponses.add(response);
            
            log.info("✅ Published job {} for missing guardian {}", 
                     response.getJobId(), missingGuardian.getSequenceOrder());
        }
        
        log.info("✅ All compensated decryption jobs published: {} jobs total", jobResponses.size());
        
        return jobResponses;
    }
}
