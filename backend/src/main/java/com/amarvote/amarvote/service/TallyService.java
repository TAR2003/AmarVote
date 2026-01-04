package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ChunkConfiguration;
import com.amarvote.amarvote.dto.ElectionGuardTallyRequest;
import com.amarvote.amarvote.dto.ElectionGuardTallyResponse;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TallyService {

    @Autowired
    private BallotRepository ballotRepository;
    
    @Autowired
    private ElectionRepository electionRepository;
    
    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;
    
    @Autowired
    private GuardianRepository guardianRepository;
    
    @Autowired
    private SubmittedBallotRepository submittedBallotRepository;
    
    @Autowired
    private ElectionCenterRepository electionCenterRepository;
    
    @Autowired
    private ChunkingService chunkingService;
    
    @Autowired
    private WebClient webClient;
    
    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public CreateTallyResponse createTally(CreateTallyRequest request, String userEmail) {
        return createTally(request, userEmail, false);
    }
    
    @Transactional
    public CreateTallyResponse createTally(CreateTallyRequest request, String userEmail, boolean bypassEndTimeCheck) {
        try {
            System.out.println("=== TallyService.createTally START ===");
            System.out.println("Creating tally for election ID: " + request.getElection_id() + " by user: " + userEmail);
            
            // Fetch election details
            Optional<Election> electionOpt = electionRepository.findById(request.getElection_id());
            if (!electionOpt.isPresent()) {
                System.err.println("Election not found: " + request.getElection_id());
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            
            Election election = electionOpt.get();
            System.out.println("Election found: " + election.getElectionTitle());
            System.out.println("Election ending time: " + election.getEndingTime());
            System.out.println("Current time: " + Instant.now());
            
            // Check if user is authorized (admin of the election)
            // if (!election.getAdminEmail().equals(userEmail)) {
            //     return CreateTallyResponse.builder()
            //         .success(false)
            //         .message("You are not authorized to create tally for this election")
            //         .build();
            // }
            
            // Check if election has ended (ending time has passed)
            if (!bypassEndTimeCheck && election.getEndingTime().isAfter(Instant.now())) {
                System.err.println("Election has not ended yet. Ending time: " + election.getEndingTime() + ", Current time: " + Instant.now());
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election has not ended yet. Cannot create tally until election ends.")
                    .build();
            }
            
            if (bypassEndTimeCheck) {
                System.out.println("Bypassing election end time check for auto-creation during partial decryption");
            } else {
                System.out.println("Election has ended, proceeding with tally creation");
            }
            
            // Check if encrypted tally already exists (check election_center table)
            List<ElectionCenter> existingChunks = electionCenterRepository.findByElectionId(request.getElection_id());
            if (!existingChunks.isEmpty()) {
                System.out.println("Encrypted tally already exists for election (chunks found): " + request.getElection_id());
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Encrypted tally already calculated")
                    .encryptedTally("Chunked tallies exist in election_center table")
                    .build();
            }
            
            // CAST ballots for this election
            System.out.println("=== FETCHING CAST BALLOTS FOR TALLY ===");
            List<Ballot> ballots = ballotRepository.findByElectionIdAndStatus(request.getElection_id(), "cast");
            System.out.println("Found " + ballots.size() + " cast ballots in Ballot table");
            
            if (ballots.isEmpty()) {
                System.err.println("❌ NO CAST BALLOTS AVAILABLE FOR TALLY CREATION");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No cast ballots found for this election")
                    .build();
            }
            
            // ===== CHUNKING LOGIC START =====
            System.out.println("=== CALCULATING CHUNKS ===");
            ChunkConfiguration chunkConfig = chunkingService.calculateChunks(ballots.size());
            System.out.println("✅ Chunks calculated: " + chunkConfig.getNumChunks() + " chunks");
            System.out.println("Chunk sizes: " + chunkConfig.getChunkSizes());
            
            // Assign ballots to chunks randomly
            java.util.Map<Integer, List<Ballot>> chunks = chunkingService.assignBallotsToChunks(ballots, chunkConfig);
            System.out.println("✅ Ballots assigned to chunks");
            
            // Verify assignment
            if (!chunkingService.verifyChunkAssignment(ballots, chunks)) {
                System.err.println("❌ CHUNK ASSIGNMENT VERIFICATION FAILED");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Internal error: Chunk assignment verification failed")
                    .build();
            }
            System.out.println("✅ Chunk assignment verified");
            
            // Fetch election choices ONCE (same for all chunks)
            System.out.println("=== FETCHING ELECTION CHOICES ===");
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.getElection_id());
            System.out.println("Found " + electionChoices.size() + " election choices");
            
            if (electionChoices.isEmpty()) {
                System.err.println("❌ NO ELECTION CHOICES FOUND");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No election choices found for this election")
                    .build();
            }
            
            // Extract party names and candidate names (same for all chunks)
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
            
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            System.out.println("✅ Party names (" + partyNames.size() + "): " + partyNames);
            System.out.println("✅ Candidate names (" + candidateNames.size() + "): " + candidateNames);
            
            int numberOfGuardians = guardianRepository.findByElectionId(election.getElectionId()).size();
            System.out.println("Number of Guardians: " + numberOfGuardians);
            
            // Process each chunk
            for (java.util.Map.Entry<Integer, List<Ballot>> entry : chunks.entrySet()) {
                int chunkNumber = entry.getKey();
                List<Ballot> chunkBallots = entry.getValue();
                
                System.out.println("=== PROCESSING CHUNK " + chunkNumber + " ===");
                System.out.println("Chunk size: " + chunkBallots.size() + " ballots");
                
                // Create election center entry for this chunk
                ElectionCenter electionCenter = ElectionCenter.builder()
                    .electionId(request.getElection_id())
                    .build();
                electionCenter = electionCenterRepository.save(electionCenter);
                System.out.println("✅ Created election_center entry ID: " + electionCenter.getElectionCenterId());
                
                // Extract cipher texts for this chunk
                List<String> chunkEncryptedBallots = chunkBallots.stream()
                    .map(Ballot::getCipherText)
                    .collect(Collectors.toList());
                
                // Call ElectionGuard microservice for this chunk
                System.out.println("🚀 CALLING ELECTIONGUARD TALLY SERVICE FOR CHUNK " + chunkNumber);
                ElectionGuardTallyResponse guardResponse = callElectionGuardTallyService(
                    partyNames, 
                    candidateNames, 
                    election.getJointPublicKey(), 
                    election.getBaseHash(), 
                    chunkEncryptedBallots,
                    election.getElectionQuorum(),
                    numberOfGuardians
                );
                
                if (!"success".equals(guardResponse.getStatus())) {
                    System.err.println("❌ ELECTIONGUARD SERVICE FAILED FOR CHUNK " + chunkNumber + ": " + guardResponse.getMessage());
                    return CreateTallyResponse.builder()
                        .success(false)
                        .message("Failed to create encrypted tally for chunk " + chunkNumber + ": " + guardResponse.getMessage())
                        .build();
                }
                
                System.out.println("✅ ElectionGuard service succeeded for chunk " + chunkNumber);
                
                // Store encrypted tally for this chunk
                String ciphertextTallyJson = guardResponse.getCiphertext_tally();
                electionCenter.setEncryptedTally(ciphertextTallyJson);
                electionCenterRepository.save(electionCenter);
                System.out.println("✅ Encrypted tally saved for chunk " + chunkNumber);
                
                // Save submitted_ballots for this chunk (linked to election_center_id)
                if (guardResponse.getSubmitted_ballots() != null && guardResponse.getSubmitted_ballots().length > 0) {
                    System.out.println("Processing " + guardResponse.getSubmitted_ballots().length + " submitted ballots for chunk " + chunkNumber);
                    
                    int savedCount = 0;
                    for (String submittedBallotCipherText : guardResponse.getSubmitted_ballots()) {
                        try {
                            if (!submittedBallotRepository.existsByElectionCenterIdAndCipherText(
                                    electionCenter.getElectionCenterId(), submittedBallotCipherText)) {
                                SubmittedBallot submittedBallot = SubmittedBallot.builder()
                                    .electionCenterId(electionCenter.getElectionCenterId())
                                    .cipherText(submittedBallotCipherText)
                                    .build();
                                
                                submittedBallotRepository.save(submittedBallot);
                                savedCount++;
                            }
                        } catch (Exception e) {
                            System.err.println("Error saving submitted ballot for chunk " + chunkNumber + ": " + e.getMessage());
                        }
                    }
                    
                    System.out.println("✅ Saved " + savedCount + " submitted ballots for chunk " + chunkNumber);
                }
            }
            // ===== CHUNKING LOGIC END =====
            
            // Update election status to completed
            election.setStatus("completed");
            electionRepository.save(election);
            
            System.out.println("=== TALLY CREATION COMPLETED SUCCESSFULLY ===");
            System.out.println("✅ Created " + chunkConfig.getNumChunks() + " chunks for election: " + request.getElection_id());
            
            return CreateTallyResponse.builder()
                .success(true)
                .message("Encrypted tally created successfully with " + chunkConfig.getNumChunks() + " chunks")
                .encryptedTally("Chunked tallies stored in election_center table")
                .build();
                
        } catch (Exception e) {
            System.err.println("❌ EXCEPTION in TallyService.createTally(): " + e.getMessage());
            e.printStackTrace();
            return CreateTallyResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }
    
    private ElectionGuardTallyResponse callElectionGuardTallyService(
            List<String> partyNames, List<String> candidateNames, 
            String jointPublicKey, String commitmentHash, List<String> encryptedBallots,
            int quorum, int numberOfGuardians) {
        
        System.out.println("=== CALLING ELECTIONGUARD MICROSERVICE ===");
        System.out.println("Service endpoint: /create_encrypted_tally");
        System.out.println("Party names count: " + partyNames.size());
        System.out.println("Candidate names count: " + candidateNames.size());
        System.out.println("Encrypted ballots count: " + encryptedBallots.size());
        System.out.println("Quorum: " + quorum);
        System.out.println("Number of guardians: " + numberOfGuardians);
        
        try {
            String url = "/create_encrypted_tally";
            
            ElectionGuardTallyRequest request = ElectionGuardTallyRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .joint_public_key(jointPublicKey)
                .commitment_hash(commitmentHash)
                .encrypted_ballots(encryptedBallots)
                .number_of_guardians(numberOfGuardians)
                .quorum(quorum)
                .build();

            System.out.println("🚀 Sending request to ElectionGuard service at: " + url);
            System.out.println("Request prepared successfully");
            
            String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
            System.out.println("✅ Received response from ElectionGuard tally service");
            System.out.println("Response received (length: " + (response != null ? response.length() : 0) + " chars)");
            
            if (response == null) {
                System.err.println("❌ NULL response from ElectionGuard service");
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            ElectionGuardTallyResponse parsedResponse = objectMapper.readValue(response, ElectionGuardTallyResponse.class);
            System.out.println("✅ Response parsed successfully");
            return parsedResponse;
        } catch (Exception e) {
            System.err.println("❌ EXCEPTION in ElectionGuard service call: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }

    /**
     * Utility method to remove duplicate submitted ballots for an election
     * This can be called if duplicates are found in the database
     */
    @Transactional
    public void removeDuplicateSubmittedBallots(Integer electionId) {
        try {
            // TODO: Update to work with chunks - SubmittedBallot now uses election_center_id
            // List<SubmittedBallot> allBallots = submittedBallotRepository.findByElectionCenterId(electionCenterId);
            List<SubmittedBallot> allBallots = submittedBallotRepository.findAll(); // Temporary workaround
            
            // Group by cipher_text and keep only the first occurrence (earliest created)
            List<SubmittedBallot> ballotsToDelete = allBallots.stream()
                .collect(Collectors.groupingBy(SubmittedBallot::getCipherText))
                .values()
                .stream()
                .filter(group -> group.size() > 1) // Only groups with duplicates
                .flatMap(group -> {
                    // Sort by ID (assuming lower ID means earlier creation) and skip the first
                    return group.stream()
                            .sorted((a, b) -> a.getSubmittedBallotId().compareTo(b.getSubmittedBallotId()))
                            .skip(1);
                })
                .collect(Collectors.toList());
            
            if (!ballotsToDelete.isEmpty()) {
                submittedBallotRepository.deleteAll(ballotsToDelete);
                System.out.println("Removed " + ballotsToDelete.size() + " duplicate submitted ballots for election: " + electionId);
            } else {
                System.out.println("No duplicate submitted ballots found for election: " + electionId);
            }
        } catch (Exception e) {
            System.err.println("Error removing duplicate submitted ballots for election " + electionId + ": " + e.getMessage());
            throw new RuntimeException("Failed to remove duplicate submitted ballots", e);
        }
    }
}
