package com.amarvote.amarvote.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.CombinePartialDecryptionRequest;
import com.amarvote.amarvote.dto.queue.JobResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service for combining decryption shares using message queue
 * 
 * This replaces the synchronous combine operation with queue-based processing:
 * 1. Validates election and decryption shares exist
 * 2. Publishes chunk IDs to RabbitMQ
 * 3. Returns immediately with job ID
 * 4. Workers process each chunk independently
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CombineDecryptionQueueService {

    private final ElectionRepository electionRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final QueuePublisherService queuePublisherService;
    private final ObjectMapper objectMapper;

    /**
     * Combine decryption shares using message queue
     * 
     * This method:
     * 1. Validates election exists
     * 2. Gets all chunk IDs
     * 3. Publishes chunk IDs to queue
     * 4. Returns immediately with job ID
     * 
     * Workers then:
     * - Fetch partial decryptions for each chunk
     * - Fetch compensated decryptions if needed
     * - Call ElectionGuard microservice to combine
     * - Store final results
     */
    @Transactional
    public JobResponse combinePartialDecryptionAsync(CombinePartialDecryptionRequest request, String userEmail) {
        
        log.info("=== Combining Decryption Shares (Queue Mode) ===");
        log.info("Election ID: {}", request.election_id());
        
        // 1. Verify election exists
        Optional<Election> electionOpt = electionRepository.findById(request.election_id());
        if (!electionOpt.isPresent()) {
            throw new RuntimeException("Election not found");
        }
        
        Election election = electionOpt.get();
        
        // 2. Get all chunk IDs
        List<Long> electionCenterIds = electionCenterRepository
                .findElectionCenterIdsByElectionId(request.election_id());
        
        if (electionCenterIds.isEmpty()) {
            throw new RuntimeException("No tally chunks found for this election");
        }
        
        log.info("✅ Found {} chunks to combine", electionCenterIds.size());
        
        // 3. Prepare metadata (if needed for workers)
        // For combine operation, metadata is minimal since workers fetch everything from DB
        String metadataJson = "{}";
        
        // 4. Publish job to queue
        JobResponse response = queuePublisherService.publishCombineJob(
                request.election_id(),
                electionCenterIds,
                metadataJson,
                userEmail
        );
        
        log.info("✅ Combine decryption job published: {}", response.getJobId());
        log.info("📊 Poll URL: {}", response.getPollUrl());
        
        return response;
    }
}
