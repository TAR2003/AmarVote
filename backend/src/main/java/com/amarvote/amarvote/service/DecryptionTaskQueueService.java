package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.worker.CombineDecryptionTask;
import com.amarvote.amarvote.dto.worker.CompensatedDecryptionTask;
import com.amarvote.amarvote.dto.worker.PartialDecryptionTask;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

/**
 * Helper service to register decryption tasks with RoundRobinTaskScheduler
 * This service encapsulates the logic to prepare and submit tasks to the scheduler
 * 
 * IMPORTANT: All tasks are registered with the scheduler, which handles fair round-robin publishing
 */
@Service
@RequiredArgsConstructor
public class DecryptionTaskQueueService {

    private final RoundRobinTaskScheduler roundRobinTaskScheduler;
    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final GuardianRepository guardianRepository;
    private final ObjectMapper objectMapper;

    /**
     * Get access to the RoundRobinTaskScheduler for progress tracking
     */
    public RoundRobinTaskScheduler getRoundRobinTaskScheduler() {
        return roundRobinTaskScheduler;
    }

    /**
     * Register partial decryption tasks with round-robin scheduler
     * @param electionId The election ID
     * @param guardianId The guardian ID
     * @param electionCenterIds List of chunk IDs to process
     * @param decryptedPrivateKey Decrypted private key
     * @param decryptedPolynomial Decrypted polynomial
     */
    public void queuePartialDecryptionTasks(
            Long electionId,
            Long guardianId,
            List<Long> electionCenterIds,
            String decryptedPrivateKey,
            String decryptedPolynomial) {
        
        System.out.println("=== REGISTERING PARTIAL DECRYPTION TASK WITH SCHEDULER ===");
        System.out.println("Election ID: " + electionId + ", Guardian ID: " + guardianId);
        System.out.println("Number of chunks: " + electionCenterIds.size());
        
        // Fetch guardian info
        Guardian guardian = guardianRepository.findById(guardianId)
            .orElseThrow(() -> new RuntimeException("Guardian not found"));
        
        // Fetch election info
        Election election = electionRepository.findById(electionId)
            .orElseThrow(() -> new RuntimeException("Election not found"));
        
        // Fetch election choices (cached)
        List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId);
        List<String> candidateNames = choices.stream()
            .map(ElectionChoice::getOptionTitle)
            .collect(Collectors.toList());
        List<String> partyNames = choices.stream()
            .map(ElectionChoice::getPartyName)
            .distinct()
            .collect(Collectors.toList());
        
        // Get guardian count
        int numberOfGuardians = guardianRepository.findByElectionId(electionId).size();
        
        // Prepare task data for all chunks
        List<String> taskDataList = new ArrayList<>();
        int chunkNumber = 0;
        for (Long electionCenterId : electionCenterIds) {
            chunkNumber++;
            
            PartialDecryptionTask task = PartialDecryptionTask.builder()
                .electionId(electionId)
                .electionCenterId(electionCenterId)
                .chunkNumber(chunkNumber)
                .guardianId(guardianId)
                .guardianSequenceOrder(String.valueOf(guardian.getSequenceOrder()))
                .guardianPublicKey(guardian.getGuardianPublicKey())
                .decryptedPrivateKey(decryptedPrivateKey)
                .decryptedPolynomial(decryptedPolynomial)
                .candidateNames(candidateNames)
                .partyNames(partyNames)
                .numberOfGuardians(numberOfGuardians)
                .jointPublicKey(election.getJointPublicKey())
                .baseHash(election.getBaseHash())
                .quorum(election.getElectionQuorum())
                .build();
            
            // Serialize task to JSON
            try {
                String taskJson = objectMapper.writeValueAsString(task);
                taskDataList.add(taskJson);
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize task: " + e.getMessage());
            }
            
            System.out.println("✅ Prepared task for chunk " + chunkNumber + " (election_center_id: " + electionCenterId + ")");
        }
        
        // Register with scheduler
        String taskInstanceId = roundRobinTaskScheduler.registerTask(
            com.amarvote.amarvote.model.scheduler.TaskType.PARTIAL_DECRYPTION,
            electionId,
            guardianId,
            null, // no sourceGuardianId
            null, // no targetGuardianId
            taskDataList
        );
        
        System.out.println("=== PARTIAL DECRYPTION TASK REGISTERED WITH SCHEDULER ===");
        System.out.println("✅ Task Instance ID: " + taskInstanceId);
        System.out.println("Scheduler will publish chunks in fair round-robin order");
    }

    /**
     * Register compensated decryption tasks with round-robin scheduler
     * @param electionId The election ID
     * @param sourceGuardianId The guardian creating compensated shares
     * @param electionCenterIds List of chunk IDs to process
     * @param decryptedPrivateKey Source guardian's decrypted private key
     * @param decryptedPolynomial Source guardian's decrypted polynomial
     */
    public void queueCompensatedDecryptionTasks(
            Long electionId,
            Long sourceGuardianId,
            List<Long> electionCenterIds,
            String decryptedPrivateKey,
            String decryptedPolynomial) {
        
        System.out.println("=== REGISTERING COMPENSATED DECRYPTION TASKS WITH SCHEDULER ===");
        System.out.println("Election ID: " + electionId + ", Source Guardian ID: " + sourceGuardianId);
        
        // Fetch source guardian
        Guardian sourceGuardian = guardianRepository.findById(sourceGuardianId)
            .orElseThrow(() -> new RuntimeException("Source guardian not found"));
        
        // Fetch election info
        Election election = electionRepository.findById(electionId)
            .orElseThrow(() -> new RuntimeException("Election not found"));
        
        // Fetch election choices (cached)
        List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId);
        List<String> candidateNames = choices.stream()
            .map(ElectionChoice::getOptionTitle)
            .collect(Collectors.toList());
        List<String> partyNames = choices.stream()
            .map(ElectionChoice::getPartyName)
            .distinct()
            .collect(Collectors.toList());
        
        // Get all guardians and filter out source guardian
        List<Guardian> allGuardians = guardianRepository.findByElectionId(electionId);
        List<Guardian> otherGuardians = allGuardians.stream()
            .filter(g -> !g.getGuardianId().equals(sourceGuardianId))
            .sorted((g1, g2) -> g1.getSequenceOrder().compareTo(g2.getSequenceOrder()))
            .collect(Collectors.toList());
        
        System.out.println("Number of other guardians: " + otherGuardians.size());
        System.out.println("Number of chunks: " + electionCenterIds.size());
        
        // Handle single guardian case - no compensated shares needed
        if (otherGuardians.isEmpty()) {
            System.out.println("✅ Single guardian election - no compensated shares needed");
            System.out.println("=== COMPENSATED DECRYPTION TASKS SKIPPED (SINGLE GUARDIAN) ===");
            return;
        }
        
        System.out.println("Total task instances to register: " + otherGuardians.size() + " (one per target guardian)");
        
        // Register one task instance per target guardian
        // Each task instance will have chunks for all election centers
        for (Guardian targetGuardian : otherGuardians) {
            List<String> taskDataList = new ArrayList<>();
            int chunkNumber = 0;
            
            for (Long electionCenterId : electionCenterIds) {
                chunkNumber++;
                
                CompensatedDecryptionTask task = CompensatedDecryptionTask.builder()
                    .electionId(electionId)
                    .electionCenterId(electionCenterId)
                    .chunkNumber(chunkNumber)
                    .sourceGuardianId(sourceGuardianId)
                    .sourceGuardianSequenceOrder(String.valueOf(sourceGuardian.getSequenceOrder()))
                    .sourceGuardianPublicKey(sourceGuardian.getGuardianPublicKey())
                    .sourceGuardianKeyBackup(sourceGuardian.getKeyBackup()) // Full guardian data with backups
                    .decryptedPrivateKey(decryptedPrivateKey)
                    .decryptedPolynomial(decryptedPolynomial)
                    .targetGuardianId(targetGuardian.getGuardianId())
                    .targetGuardianSequenceOrder(String.valueOf(targetGuardian.getSequenceOrder()))
                    .targetGuardianPublicKey(targetGuardian.getGuardianPublicKey())
                    .targetGuardianKeyBackup(targetGuardian.getKeyBackup()) // Full guardian data
                    .candidateNames(candidateNames)
                    .partyNames(partyNames)
                    .numberOfGuardians(allGuardians.size())
                    .jointPublicKey(election.getJointPublicKey())
                    .baseHash(election.getBaseHash())
                    .quorum(election.getElectionQuorum())
                    .build();
                
                // Serialize task to JSON
                try {
                    String taskJson = objectMapper.writeValueAsString(task);
                    taskDataList.add(taskJson);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to serialize task: " + e.getMessage());
                }
            }
            
            // Register task instance for this target guardian
            String taskInstanceId = roundRobinTaskScheduler.registerTask(
                com.amarvote.amarvote.model.scheduler.TaskType.COMPENSATED_DECRYPTION,
                electionId,
                null, // no single guardianId
                sourceGuardianId,
                targetGuardian.getGuardianId(),
                taskDataList
            );
            
            System.out.println("✅ Registered task instance " + taskInstanceId + " for target guardian " + 
                targetGuardian.getSequenceOrder() + " with " + electionCenterIds.size() + " chunks");
        }
        
        System.out.println("=== ALL COMPENSATED DECRYPTION TASKS REGISTERED WITH SCHEDULER ===");
        System.out.println("Scheduler will publish chunks in fair round-robin order across all task instances");
    }

    /**
     * Register combine decryption tasks with round-robin scheduler
     * @param electionId The election ID
     * @param electionCenterIds List of chunk IDs to process
     */
    public void queueCombineDecryptionTasks(Long electionId, List<Long> electionCenterIds) {
        System.out.println("=== REGISTERING COMBINE DECRYPTION TASKS WITH SCHEDULER ===");
        System.out.println("Election ID: " + electionId);
        System.out.println("Number of chunks: " + electionCenterIds.size());
        
        // Fetch election info
        Election election = electionRepository.findById(electionId)
            .orElseThrow(() -> new RuntimeException("Election not found"));
        
        // Fetch election choices (cached)
        List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId);
        List<String> candidateNames = choices.stream()
            .map(ElectionChoice::getOptionTitle)
            .collect(Collectors.toList());
        List<String> partyNames = choices.stream()
            .map(ElectionChoice::getPartyName)
            .distinct()
            .collect(Collectors.toList());
        
        // Get guardian count
        int numberOfGuardians = guardianRepository.findByElectionId(electionId).size();
        
        // Prepare task data for all chunks
        List<String> taskDataList = new ArrayList<>();
        int chunkNumber = 0;
        for (Long electionCenterId : electionCenterIds) {
            chunkNumber++;
            
            CombineDecryptionTask task = CombineDecryptionTask.builder()
                .electionId(electionId)
                .electionCenterId(electionCenterId)
                .chunkNumber(chunkNumber)
                .candidateNames(candidateNames)
                .partyNames(partyNames)
                .numberOfGuardians(numberOfGuardians)
                .jointPublicKey(election.getJointPublicKey())
                .baseHash(election.getBaseHash())
                .quorum(election.getElectionQuorum())
                .build();
            
            // Serialize task to JSON
            try {
                String taskJson = objectMapper.writeValueAsString(task);
                taskDataList.add(taskJson);
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize task: " + e.getMessage());
            }
            
            System.out.println("✅ Prepared task for chunk " + chunkNumber + " (election_center_id: " + electionCenterId + ")");
        }
        
        // Register with scheduler
        String taskInstanceId = roundRobinTaskScheduler.registerTask(
            com.amarvote.amarvote.model.scheduler.TaskType.COMBINE_DECRYPTION,
            electionId,
            null, // no guardianId
            null, // no sourceGuardianId
            null, // no targetGuardianId
            taskDataList
        );
        
        System.out.println("=== COMBINE DECRYPTION TASK REGISTERED WITH SCHEDULER ===");
        System.out.println("✅ Task Instance ID: " + taskInstanceId);
        System.out.println("Scheduler will publish chunks in fair round-robin order");
    }
}
