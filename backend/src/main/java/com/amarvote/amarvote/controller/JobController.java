package com.amarvote.amarvote.controller;

import com.amarvote.amarvote.dto.queue.JobStatusResponse;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * REST Controller for job status polling
 * 
 * Frontend can poll these endpoints to track progress:
 * - GET /api/jobs/{jobId}/status - Get status of specific job
 * - GET /api/jobs/election/{electionId} - Get all jobs for an election
 */
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class JobController {

    private final ElectionJobRepository jobRepository;

    /**
     * Get status of a specific job
     * 
     * Frontend should poll this endpoint every 2-5 seconds to update progress bar
     * 
     * Example response:
     * {
     *   "jobId": "abc-123",
     *   "status": "IN_PROGRESS",
     *   "totalChunks": 2000,
     *   "processedChunks": 450,
     *   "progressPercent": 22.5
     * }
     */
    @GetMapping("/{jobId}/status")
    public ResponseEntity<JobStatusResponse> getJobStatus(@PathVariable String jobId) {
        try {
            UUID uuid = UUID.fromString(jobId);
            
            ElectionJob job = jobRepository.findById(uuid)
                    .orElseThrow(() -> new RuntimeException("Job not found"));
            
            JobStatusResponse response = JobStatusResponse.builder()
                    .jobId(job.getJobId())
                    .status(job.getStatus())
                    .totalChunks(job.getTotalChunks())
                    .processedChunks(job.getProcessedChunks())
                    .failedChunks(job.getFailedChunks())
                    .progressPercent(job.getProgressPercent())
                    .startedAt(job.getStartedAt())
                    .completedAt(job.getCompletedAt())
                    .errorMessage(job.getErrorMessage())
                    .operationType(job.getOperationType())
                    .electionId(job.getElectionId())
                    .build();
            
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            log.error("Invalid job ID format: {}", jobId);
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error fetching job status: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get all jobs for an election
     * 
     * Useful for displaying job history on admin dashboard
     */
    @GetMapping("/election/{electionId}")
    public ResponseEntity<List<JobStatusResponse>> getJobsByElection(@PathVariable Long electionId) {
        try {
            List<ElectionJob> jobs = jobRepository.findByElectionIdOrderByStartedAtDesc(electionId);
            
            List<JobStatusResponse> responses = jobs.stream()
                    .map(job -> JobStatusResponse.builder()
                            .jobId(job.getJobId())
                            .status(job.getStatus())
                            .totalChunks(job.getTotalChunks())
                            .processedChunks(job.getProcessedChunks())
                            .failedChunks(job.getFailedChunks())
                            .progressPercent(job.getProgressPercent())
                            .startedAt(job.getStartedAt())
                            .completedAt(job.getCompletedAt())
                            .errorMessage(job.getErrorMessage())
                            .operationType(job.getOperationType())
                            .electionId(job.getElectionId())
                            .build())
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(responses);
            
        } catch (Exception e) {
            log.error("Error fetching jobs for election: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get all active jobs (for monitoring)
     */
    @GetMapping("/active")
    public ResponseEntity<List<JobStatusResponse>> getActiveJobs() {
        try {
            List<ElectionJob> jobs = jobRepository.findActiveJobs();
            
            List<JobStatusResponse> responses = jobs.stream()
                    .map(job -> JobStatusResponse.builder()
                            .jobId(job.getJobId())
                            .status(job.getStatus())
                            .totalChunks(job.getTotalChunks())
                            .processedChunks(job.getProcessedChunks())
                            .failedChunks(job.getFailedChunks())
                            .progressPercent(job.getProgressPercent())
                            .startedAt(job.getStartedAt())
                            .completedAt(job.getCompletedAt())
                            .errorMessage(job.getErrorMessage())
                            .operationType(job.getOperationType())
                            .electionId(job.getElectionId())
                            .build())
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(responses);
            
        } catch (Exception e) {
            log.error("Error fetching active jobs: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
