package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.queue.JobResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.worker.TallyWorker;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service for creating tally using message queue (Tier 3)
 * 
 * This replaces the synchronous tally creation with queue-based processing:
 * 1. Validates election has ended
 * 2. Creates election center chunks
 * 3. Publishes chunk IDs to RabbitMQ
 * 4. Returns immediately with job ID
 * 5. Workers process chunks in background
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TallyQueueService {

    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final BallotRepository ballotRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final QueuePublisherService queuePublisherService;
    private final ChunkingService chunkingService;
    private final ObjectMapper objectMapper;

    /**
     * Create tally using message queue (Tier 3)
     * 
     * This method:
     * 1. Validates election
     * 2. Creates empty ElectionCenter records (chunks)
     * 3. Publishes chunk IDs to queue
     * 4. Returns immediately
     * 
     * Workers then process each chunk independently
     */
    @Transactional
    public JobResponse createTallyAsync(CreateTallyRequest request, String userEmail) {
        
        log.info("=== Creating Tally (Queue Mode) ===");
        log.info("Election ID: {}, User: {}", request.getElection_id(), userEmail);
        
        // 1. Verify election has ended
        Optional<Election> electionOpt = electionRepository.findById(request.getElection_id());
        if (electionOpt.isEmpty()) {
            throw new RuntimeException("Election not found");
        }
        
        Election election = electionOpt.get();
        if (election.getEndingTime().isAfter(Instant.now())) {
            throw new RuntimeException("Election has not ended yet. Cannot create tally until election ends.");
        }
        
        // 2. Check if tally already exists
        List<ElectionCenter> existingChunks = electionCenterRepository.findByElectionId(request.getElection_id());
        if (!existingChunks.isEmpty()) {
            throw new RuntimeException("Tally already exists for this election");
        }
        
        // 3. Get ballot count (just count, don't load ballots)
        List<Long> ballotIds = ballotRepository.findBallotIdsByElectionIdAndStatus(request.getElection_id(), "cast");
        
        if (ballotIds.isEmpty()) {
            throw new RuntimeException("No cast ballots found for this election");
        }
        
        log.info("✅ Found {} ballots", ballotIds.size());
        
        // 4. Calculate chunks
        com.amarvote.amarvote.dto.ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballotIds.size());
        log.info("✅ Calculated {} chunks", chunkConfig.getNumChunks());
        
        // 5. Note: We could assign ballot IDs to chunks here, but workers will
        //    distribute ballots algorithmically (by chunk index) to avoid storing mappings
        
        // 6. Create empty ElectionCenter records (one per chunk)
        List<Long> electionCenterIds = new java.util.ArrayList<>();
        
        for (int chunkNumber = 0; chunkNumber < chunkConfig.getNumChunks(); chunkNumber++) {
            ElectionCenter center = ElectionCenter.builder()
                    .electionId(request.getElection_id())
                    .build();
            center = electionCenterRepository.save(center);
            electionCenterIds.add(center.getElectionCenterId());
            
            // Store mapping: chunk -> ballot IDs (for worker to use later)
            // For now, workers will query ballots by election center
        }
        
        log.info("✅ Created {} ElectionCenter records", electionCenterIds.size());
        
        // 7. Prepare metadata for workers
        List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.getElection_id());
        List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
        List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
        
        TallyWorker.TallyMetadata metadata = new TallyWorker.TallyMetadata(
                partyNames,
                candidateNames,
                election.getJointPublicKey(),
                election.getBaseHash(),
                election.getElectionQuorum(),
                election.getNumberOfGuardians()
        );
        
        String metadataJson;
        try {
            metadataJson = objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize metadata", e);
        }
        
        // 8. Publish job to queue
        JobResponse response = queuePublisherService.publishTallyJob(
                request.getElection_id(),
                electionCenterIds,
                metadataJson,
                userEmail
        );
        
        log.info("✅ Tally job published: {}", response.getJobId());
        log.info("📊 Poll URL: {}", response.getPollUrl());
        
        return response;
    }
}
