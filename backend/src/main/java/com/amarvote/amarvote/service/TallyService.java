package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionGuardTallyRequest;
import com.amarvote.amarvote.dto.ElectionGuardTallyResponse;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.BallotRepository;
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
    private WebClient webClient;
    
    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public CreateTallyResponse createTally(CreateTallyRequest request, String userEmail) {
        try {
            System.out.println("Creating tally for election ID: " + request.getElection_id() + " by user: " + userEmail);
            
            // Fetch election details
            Optional<Election> electionOpt = electionRepository.findById(request.getElection_id());
            if (!electionOpt.isPresent()) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            
            Election election = electionOpt.get();
            
            // Check if user is authorized (admin of the election)
            // if (!election.getAdminEmail().equals(userEmail)) {
            //     return CreateTallyResponse.builder()
            //         .success(false)
            //         .message("You are not authorized to create tally for this election")
            //         .build();
            // }
            
            // Check if election has ended (ending time has passed)
            if (election.getEndingTime().isAfter(Instant.now())) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election has not ended yet. Cannot create tally until election ends.")
                    .build();
            }
            
            // Check if encrypted tally already exists
            if (election.getEncryptedTally() != null && !election.getEncryptedTally().trim().isEmpty()) {
                System.out.println("Encrypted tally already exists for election: " + request.getElection_id());
                return CreateTallyResponse.builder()
                    .success(true)
                    .message("Encrypted tally already calculated")
                    .encryptedTally(election.getEncryptedTally())
                    .build();
            }
            
            // Fetch all ballots for this election
            List<Ballot> ballots = ballotRepository.findByElectionId(request.getElection_id());
            if (ballots.isEmpty()) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No ballots found for this election")
                    .build();
            }
            
            // Extract cipher_text from ballots
            List<String> encryptedBallots = ballots.stream()
                .map(Ballot::getCipherText)
                .collect(Collectors.toList());
            
            System.out.println("Found " + encryptedBallots.size() + " encrypted ballots");
            
            // Fetch election choices
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionId(request.getElection_id());
            if (electionChoices.isEmpty()) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No election choices found for this election")
                    .build();
            }
            electionChoices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            
            // Extract party names and candidate names
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .distinct()
                .collect(Collectors.toList());
            
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            System.out.println("Party names: " + partyNames);
            System.out.println("Candidate names: " + candidateNames);
            
            // Call ElectionGuard microservice
            ElectionGuardTallyResponse guardResponse = callElectionGuardTallyService(
                partyNames, 
                candidateNames, 
                election.getJointPublicKey(), 
                election.getBaseHash(), 
                encryptedBallots,
                election.getElectionQuorum(),
                guardianRepository.findByElectionId(election.getElectionId()).size()
            );
            
            if (!"success".equals(guardResponse.getStatus())) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Failed to create encrypted tally: " + guardResponse.getMessage())
                    .build();
            }
            
            // ✅ Fixed: Store ciphertext_tally directly as string (no double serialization)
            String ciphertextTallyJson = guardResponse.getCiphertext_tally(); // Store directly
            
            election.setEncryptedTally(ciphertextTallyJson);
            electionRepository.save(election);
            
            // Save submitted_ballots from ElectionGuard response
            if (guardResponse.getSubmitted_ballots() != null && guardResponse.getSubmitted_ballots().length > 0) {
                System.out.println("Processing " + guardResponse.getSubmitted_ballots().length + " submitted ballots for election: " + request.getElection_id());
                
                int savedCount = 0;
                int duplicateCount = 0;
                int errorCount = 0;
                
                for (String submittedBallotCipherText : guardResponse.getSubmitted_ballots()) {
                    try {
                        // Check if this ballot already exists to prevent duplicates
                        if (!submittedBallotRepository.existsByElectionIdAndCipherText(request.getElection_id(), submittedBallotCipherText)) {
                            SubmittedBallot submittedBallot = SubmittedBallot.builder()
                                .electionId(request.getElection_id())
                                .cipherText(submittedBallotCipherText)
                                .build();
                            
                            submittedBallotRepository.save(submittedBallot);
                            savedCount++;
                        } else {
                            duplicateCount++;
                            System.out.println("Skipping duplicate submitted ballot for election: " + request.getElection_id());
                        }
                    } catch (org.springframework.dao.DataIntegrityViolationException e) {
                        // Handle database constraint violations (like unique constraint violations)
                        duplicateCount++;
                        System.out.println("Database prevented duplicate ballot insertion for election: " + request.getElection_id() + " - " + e.getMessage());
                    } catch (Exception e) {
                        // Handle other unexpected errors
                        errorCount++;
                        System.err.println("Error saving submitted ballot for election " + request.getElection_id() + ": " + e.getMessage());
                    }
                }
                
                System.out.println("Successfully saved " + savedCount + " new submitted ballots for election: " + request.getElection_id() + 
                                 (duplicateCount > 0 ? " (skipped " + duplicateCount + " duplicates)" : "") +
                                 (errorCount > 0 ? " (errors: " + errorCount + ")" : ""));
            } else {
                System.out.println("No submitted ballots received from ElectionGuard for election: " + request.getElection_id());
            }
            
            System.out.println("Successfully created and saved encrypted tally for election: " + request.getElection_id());
            
            return CreateTallyResponse.builder()
                .success(true)
                .message("Encrypted tally created successfully")
                .encryptedTally(ciphertextTallyJson)
                .build();
                
        } catch (Exception e) {
            System.err.println("Error creating tally: " + e.getMessage());
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

            System.out.println("Calling ElectionGuard tally service at: " + url);
            System.out.println("Sending request to ElectionGuard service: " + request);
            
            String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            
            System.out.println("Received response from ElectionGuard tally service");
            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            return objectMapper.readValue(response, ElectionGuardTallyResponse.class);
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard tally service: " + e.getMessage());
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
            List<SubmittedBallot> allBallots = submittedBallotRepository.findByElectionId(electionId.longValue());
            
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
