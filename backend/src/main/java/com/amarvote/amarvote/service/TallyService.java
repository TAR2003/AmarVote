package com.amarvote.amarvote.service;

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
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
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
            if (!election.getAdminEmail().equals(userEmail)) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("You are not authorized to create tally for this election")
                    .build();
            }
            
            // Check if election is completed
            if (!"completed".equals(election.getStatus())) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Election must be completed before creating tally")
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
                encryptedBallots
            );
            
            if (!"success".equals(guardResponse.getStatus())) {
                return CreateTallyResponse.builder()
                    .success(false)
                    .message("Failed to create encrypted tally: " + guardResponse.getMessage())
                    .build();
            }
            
            // Update election with encrypted tally (save ciphertext_tally as JSONB string)
            String ciphertextTallyJson = null;
            if (guardResponse.getCiphertext_tally() != null) {
                try {
                    ciphertextTallyJson = objectMapper.writeValueAsString(guardResponse.getCiphertext_tally());
                } catch (Exception e) {
                    System.err.println("Failed to serialize ciphertext_tally: " + e.getMessage());
                    return CreateTallyResponse.builder()
                        .success(false)
                        .message("Failed to serialize encrypted tally")
                        .build();
                }
            }
            
            election.setEncryptedTally(ciphertextTallyJson);
            electionRepository.save(election);
            
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
            String jointPublicKey, String commitmentHash, List<String> encryptedBallots) {
        
        try {
            String url = "/create_encrypted_tally";
            
            ElectionGuardTallyRequest request = ElectionGuardTallyRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .joint_public_key(jointPublicKey)
                .commitment_hash(commitmentHash)
                .encrypted_ballots(encryptedBallots)
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
}
