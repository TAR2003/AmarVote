package com.amarvote.amarvote.service;

import com.amarvote.amarvote.dto.worker.CombineDecryptionTask;
import com.amarvote.amarvote.dto.worker.CompensatedDecryptionTask;
import com.amarvote.amarvote.dto.worker.PartialDecryptionTask;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Helper service to queue decryption tasks to RabbitMQ
 * This service encapsulates the logic to prepare and submit tasks to the queue
 */
@Service
@RequiredArgsConstructor
public class DecryptionTaskQueueService {

    private final TaskPublisherService taskPublisherService;
    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final GuardianRepository guardianRepository;

    /**
     * Queue partial decryption tasks for all chunks
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
        
        System.out.println("=== QUEUEING PARTIAL DECRYPTION TASKS ===");
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
        
        // Queue tasks for each chunk
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
            
            taskPublisherService.publishPartialDecryptionTask(task);
            System.out.println("✅ Task sent for chunk " + chunkNumber + " (election_center_id: " + electionCenterId + ")");
        }
        
        System.out.println("=== ALL PARTIAL DECRYPTION TASKS QUEUED ===");
    }

    /**
     * Queue compensated decryption tasks for all chunks and all other guardians
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
        
        System.out.println("=== QUEUEING COMPENSATED DECRYPTION TASKS ===");
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
        
        System.out.println("Total tasks to queue: " + (otherGuardians.size() * electionCenterIds.size()));
        
        // Queue tasks for each combination of chunk and target guardian
        int taskCount = 0;
        for (Guardian targetGuardian : otherGuardians) {
            int chunkNumber = 0;
            for (Long electionCenterId : electionCenterIds) {
                chunkNumber++;
                taskCount++;
                
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
                
                taskPublisherService.publishCompensatedDecryptionTask(task);
            }
            System.out.println("✅ Queued " + electionCenterIds.size() + " tasks for target guardian " + targetGuardian.getSequenceOrder());
        }
        
        System.out.println("=== ALL COMPENSATED DECRYPTION TASKS QUEUED ===");
        System.out.println("✅ Total tasks queued: " + taskCount);
    }

    /**
     * Queue combine decryption tasks for all chunks
     * @param electionId The election ID
     * @param electionCenterIds List of chunk IDs to process
     */
    public void queueCombineDecryptionTasks(Long electionId, List<Long> electionCenterIds) {
        System.out.println("=== QUEUEING COMBINE DECRYPTION TASKS ===");
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
        
        // Queue tasks for each chunk
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
            
            taskPublisherService.publishCombineDecryptionTask(task);
            System.out.println("✅ Task sent for chunk " + chunkNumber + " (election_center_id: " + electionCenterId + ")");
        }
        
        System.out.println("=== ALL COMBINE DECRYPTION TASKS QUEUED ===");
    }
}
