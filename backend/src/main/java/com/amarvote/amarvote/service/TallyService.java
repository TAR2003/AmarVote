package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
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
            System.out.println("=== FETCHING BALLOTS FOR TALLY ===");
            List<Ballot> ballots = ballotRepository.findByElectionId(request.getElection_id());
            System.out.println("Found " + ballots.size() + " ballots in Ballot table");
            
            // If no ballots found in Ballot table, check SubmittedBallot table
            // (This handles the case where ballots were already processed and moved to SubmittedBallot table)
            List<String> encryptedBallots = new ArrayList<>();
            
            if (!ballots.isEmpty()) {
                // Extract cipher_text from ballots
                encryptedBallots = ballots.stream()
                    .map(Ballot::getCipherText)
                    .collect(Collectors.toList());
                System.out.println("✅ Using " + encryptedBallots.size() + " encrypted ballots from Ballot table");
            } else {
                // Check SubmittedBallot table
                System.out.println("No ballots in Ballot table, checking SubmittedBallot table...");
                List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionId(request.getElection_id());
                System.out.println("Found " + submittedBallots.size() + " ballots in SubmittedBallot table");
                
                if (!submittedBallots.isEmpty()) {
                    encryptedBallots = submittedBallots.stream()
                        .map(SubmittedBallot::getCipherText)
                        .collect(Collectors.toList());
                    System.out.println("✅ Using " + encryptedBallots.size() + " encrypted ballots from SubmittedBallot table");
                } else {
                    System.err.println("❌ No ballots found in either table");
                }
            }
            
            if (encryptedBallots.isEmpty()) {
                System.err.println("❌ NO BALLOTS AVAILABLE FOR TALLY CREATION");
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("No ballots found for this election in either Ballot or SubmittedBallot tables")
                    .build();
            }
            
            System.out.println("✅ Total encrypted ballots for tally: " + encryptedBallots.size());
            
            // Fetch election choices
            System.out.println("=== FETCHING ELECTION CHOICES ===");
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionId(request.getElection_id());
            System.out.println("Found " + electionChoices.size() + " election choices");
            
            if (electionChoices.isEmpty()) {
                System.err.println("❌ NO ELECTION CHOICES FOUND");
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
            
            System.out.println("✅ Party names (" + partyNames.size() + "): " + partyNames);
            System.out.println("✅ Candidate names (" + candidateNames.size() + "): " + candidateNames);
            
            System.out.println("=== PREPARING ELECTIONGUARD SERVICE CALL ===");
            System.out.println("Joint Public Key exists: " + (election.getJointPublicKey() != null && !election.getJointPublicKey().isEmpty()));
            System.out.println("Base Hash exists: " + (election.getBaseHash() != null && !election.getBaseHash().isEmpty()));
            System.out.println("Election Quorum: " + election.getElectionQuorum());
            
            int numberOfGuardians = guardianRepository.findByElectionId(election.getElectionId()).size();
            System.out.println("Number of Guardians: " + numberOfGuardians);
            
            // Call ElectionGuard microservice
            System.out.println("🚀 CALLING ELECTIONGUARD TALLY SERVICE");
            ElectionGuardTallyResponse guardResponse = callElectionGuardTallyService(
                partyNames, 
                candidateNames, 
                election.getJointPublicKey(), 
                election.getBaseHash(), 
                encryptedBallots,
                election.getElectionQuorum(),
                numberOfGuardians
            );
            
            System.out.println("=== ELECTIONGUARD SERVICE RESPONSE ===");
            System.out.println("ElectionGuard response status: " + guardResponse.getStatus());
            System.out.println("ElectionGuard response message: " + guardResponse.getMessage());
            
            if (!"success".equals(guardResponse.getStatus())) {
                System.err.println("❌ ELECTIONGUARD SERVICE FAILED: " + guardResponse.getMessage());
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Failed to create encrypted tally: " + guardResponse.getMessage())
                    .build();
            }
            
            System.out.println("✅ ElectionGuard service succeeded");
            
            // ✅ Fixed: Store ciphertext_tally directly as string (no double serialization)
            String ciphertextTallyJson = guardResponse.getCiphertext_tally(); // Store directly
            System.out.println("=== SAVING TALLY TO DATABASE ===");
            System.out.println("Ciphertext tally length: " + (ciphertextTallyJson != null ? ciphertextTallyJson.length() : 0) + " characters");
            
            election.setEncryptedTally(ciphertextTallyJson);
            electionRepository.save(election);
            System.out.println("✅ Encrypted tally saved to election record");
            
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
            
            System.out.println("=== TALLY CREATION COMPLETED SUCCESSFULLY ===");
            System.out.println("✅ Encrypted tally created and saved for election: " + request.getElection_id());
            
            return CreateTallyResponse.builder()
                .success(true)
                .message("Encrypted tally created successfully")
                .encryptedTally(ciphertextTallyJson)
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
                .block();
            
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
