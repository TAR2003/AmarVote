package com.amarvote.amarvote.service;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.queue.ChunkMessage;
import com.amarvote.amarvote.dto.queue.JobResponse;
import com.amarvote.amarvote.dto.queue.OperationType;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Service for publishing jobs to RabbitMQ queues
 * 
 * This service:
 * 1. Creates job record in database
 * 2. Breaks work into small messages
 * 3. Publishes messages to appropriate queue
 * 4. Returns immediately with job ID
 * 
 * Workers then process messages in background
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QueuePublisherService {

    private final RabbitTemplate rabbitTemplate;
    private final ElectionJobRepository jobRepository;
    private final ObjectMapper objectMapper;

    /**
     * Publish tally creation job to queue
     * 
     * @param electionId Election ID
     * @param chunkIds List of ElectionCenter IDs to process
     * @param metadata JSON metadata containing election parameters
     * @param userEmail User who initiated the job
     * @return JobResponse with job ID and polling URL
     */
    @Transactional
    public JobResponse publishTallyJob(Long electionId, List<Long> chunkIds, 
                                       String metadata, String userEmail) {
        
        log.info("=== Publishing Tally Job ===");
        log.info("Election ID: {}, Chunks: {}, User: {}", electionId, chunkIds.size(), userEmail);
        
        // Check if job already exists
        if (jobRepository.existsActiveJob(electionId, OperationType.TALLY.name())) {
            throw new IllegalStateException("A tally job is already in progress for this election");
        }
        
        // Create job record
        UUID jobId = UUID.randomUUID();
        ElectionJob job = ElectionJob.builder()
                .jobId(jobId)
                .electionId(electionId)
                .operationType(OperationType.TALLY.name())
                .status("QUEUED")
                .totalChunks(chunkIds.size())
                .processedChunks(0)
                .failedChunks(0)
                .createdBy(userEmail)
                .startedAt(Instant.now())
                .metadata(metadata)
                .build();
        
        jobRepository.save(job);
        log.info("✅ Created job record: {}", jobId);
        
        // Publish messages to queue
        int publishedCount = 0;
        for (Long chunkId : chunkIds) {
            ChunkMessage message = ChunkMessage.builder()
                    .jobId(jobId)
                    .chunkId(chunkId)
                    .operationType(OperationType.TALLY)
                    .electionId(electionId)
                    .build();
            
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.ELECTION_EXCHANGE,
                    RabbitMQConfig.TALLY_ROUTING_KEY,
                    message
            );
            publishedCount++;
        }
        
        log.info("✅ Published {} messages to tally queue", publishedCount);
        
        // Update status to IN_PROGRESS
        job.setStatus("IN_PROGRESS");
        jobRepository.save(job);
        
        return JobResponse.builder()
                .jobId(jobId)
                .totalChunks(chunkIds.size())
                .status("IN_PROGRESS")
                .message("Tally creation job started. Processing " + chunkIds.size() + " chunks in background.")
                .pollUrl("/api/jobs/" + jobId + "/status")
                .createdAt(Instant.now())
                .success(true)
                .build();
    }

    /**
     * Publish partial decryption job to queue
     * 
     * @param electionId Election ID
     * @param guardianId Guardian ID
     * @param chunkIds List of ElectionCenter IDs to process
     * @param metadata JSON metadata containing guardian credentials and election parameters
     * @param userEmail User who initiated the job
     * @return JobResponse with job ID and polling URL
     */
    @Transactional
    public JobResponse publishDecryptionJob(Long electionId, Long guardianId, 
                                           List<Long> chunkIds, String metadata, String userEmail) {
        
        log.info("=== Publishing Decryption Job ===");
        log.info("Election ID: {}, Guardian ID: {}, Chunks: {}", electionId, guardianId, chunkIds.size());
        
        // Create job record
        UUID jobId = UUID.randomUUID();
        ElectionJob job = ElectionJob.builder()
                .jobId(jobId)
                .electionId(electionId)
                .operationType(OperationType.DECRYPTION.name())
                .status("QUEUED")
                .totalChunks(chunkIds.size())
                .processedChunks(0)
                .failedChunks(0)
                .createdBy(userEmail)
                .startedAt(Instant.now())
                .metadata(metadata)
                .build();
        
        jobRepository.save(job);
        log.info("✅ Created decryption job record: {}", jobId);
        
        // Publish messages to queue
        int publishedCount = 0;
        for (Long chunkId : chunkIds) {
            ChunkMessage message = ChunkMessage.builder()
                    .jobId(jobId)
                    .chunkId(chunkId)
                    .operationType(OperationType.DECRYPTION)
                    .electionId(electionId)
                    .guardianId(guardianId)
                    .build();
            
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.ELECTION_EXCHANGE,
                    RabbitMQConfig.DECRYPTION_ROUTING_KEY,
                    message
            );
            publishedCount++;
        }
        
        log.info("✅ Published {} messages to decryption queue", publishedCount);
        
        // Update status to IN_PROGRESS
        job.setStatus("IN_PROGRESS");
        jobRepository.save(job);
        
        return JobResponse.builder()
                .jobId(jobId)
                .totalChunks(chunkIds.size())
                .status("IN_PROGRESS")
                .message("Decryption job started. Processing " + chunkIds.size() + " chunks in background.")
                .pollUrl("/api/jobs/" + jobId + "/status")
                .createdAt(Instant.now())
                .success(true)
                .build();
    }

    /**
     * Publish combine decryption shares job to queue
     */
    @Transactional
    public JobResponse publishCombineJob(Long electionId, List<Long> chunkIds, 
                                        String metadata, String userEmail) {
        
        log.info("=== Publishing Combine Decryption Job ===");
        log.info("Election ID: {}, Chunks: {}", electionId, chunkIds.size());
        
        // Create job record
        UUID jobId = UUID.randomUUID();
        ElectionJob job = ElectionJob.builder()
                .jobId(jobId)
                .electionId(electionId)
                .operationType(OperationType.COMBINE.name())
                .status("QUEUED")
                .totalChunks(chunkIds.size())
                .processedChunks(0)
                .failedChunks(0)
                .createdBy(userEmail)
                .startedAt(Instant.now())
                .metadata(metadata)
                .build();
        
        jobRepository.save(job);
        
        // Publish messages
        for (Long chunkId : chunkIds) {
            ChunkMessage message = ChunkMessage.builder()
                    .jobId(jobId)
                    .chunkId(chunkId)
                    .operationType(OperationType.COMBINE)
                    .electionId(electionId)
                    .build();
            
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.ELECTION_EXCHANGE,
                    RabbitMQConfig.COMBINE_ROUTING_KEY,
                    message
            );
        }
        
        log.info("✅ Published {} messages to combine queue", chunkIds.size());
        
        job.setStatus("IN_PROGRESS");
        jobRepository.save(job);
        
        return JobResponse.builder()
                .jobId(jobId)
                .totalChunks(chunkIds.size())
                .status("IN_PROGRESS")
                .message("Combine decryption job started.")
                .pollUrl("/api/jobs/" + jobId + "/status")
                .createdAt(Instant.now())
                .success(true)
                .build();
    }
}
