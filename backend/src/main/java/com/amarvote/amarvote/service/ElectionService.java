package com.amarvote.amarvote.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient; // Fixed: Use Spring's HttpHeaders, not Netty's

import com.amarvote.amarvote.dto.ElectionCreationRequest; // Added: For setting content type
import com.amarvote.amarvote.dto.ElectionGuardianSetupRequest; // Added: For handling HTTP responses
import com.amarvote.amarvote.dto.ElectionGuardianSetupResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ElectionService {

    private final ElectionRepository electionRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    @Autowired
    private WebClient webClient;

    @Autowired
    private EmailService emailService;

    @Transactional
    public Election createElection(ElectionCreationRequest request) {
        // Validate candidate pictures and party pictures match names
        if (request.candidatePictures() != null
                && request.candidatePictures().size() != request.candidateNames().size()) {
            throw new IllegalArgumentException("Candidate pictures count must match candidate names");
        }

        if (request.partyPictures() != null
                && request.partyPictures().size() != request.partyNames().size()) {
            throw new IllegalArgumentException("Party pictures count must match party names");
        }

        // Call ElectionGuard microservice
        ElectionGuardianSetupRequest guardianRequest = new ElectionGuardianSetupRequest(
                Integer.parseInt(request.guardianNumber()), // guardianNumber should be int
                Integer.parseInt(request.guardianNumber()), // Same as number of guardians for quorum
                request.partyNames(),
                request.candidateNames()
        );

        ElectionGuardianSetupResponse guardianResponse = callElectionGuardService(guardianRequest);

        // Create and save election
        Election election = new Election();
        election.setElectionTitle(request.electionTitle());
        election.setElectionDescription(request.electionDescription());
        election.setNumberOfGuardians(guardianRequest.number_of_guardians());
        election.setElectionQuorum(guardianRequest.quorum());
        election.setNoOfCandidates(request.candidateNames().size());
        election.setJointPublicKey(guardianResponse.joint_public_key());
        election.setManifestHash(guardianResponse.manifest());
        election.setStatus("draft"); // Set initial status to DRAFT
        election.setStartingTime(request.startingTime());
        election.setEndingTime(request.endingTime());
        election.setBaseHash(guardianResponse.commitment_hash());

        //we have to create guardians here
        // STEP 1: Ensure guardianEmails match number of guardians
        List<String> guardianEmails = request.guardianEmails();
        List<String> guardianPrivateKeys = guardianResponse.guardian_private_keys(); // from JSON
        if (guardianEmails.size() != guardianPrivateKeys.size()) {
            throw new IllegalArgumentException("Guardian emails and private keys count must match");
        }

        // STEP 2: Send private keys via email to guardians
        for (int i = 0; i < guardianEmails.size(); i++) {
            String email = guardianEmails.get(i);
            String privateKey = guardianPrivateKeys.get(i);

            // Send email with private key
            emailService.sendGuardianPrivateKeyEmail(email, privateKey, election.getElectionTitle());

        }

        //print the private keys to console
        System.out.println("Guardian Private Keys:");
        for (int i = 0; i < guardianPrivateKeys.size(); i++) {
            System.out.printf("Guardian %d (%s) Private Key: %s%n", i + 1, guardianEmails.get(i), guardianPrivateKeys.get(i));
        }

        System.out.println("Email sent to guardians with their private keys.");

        return electionRepository.save(election);

    }

    private ElectionGuardianSetupResponse callElectionGuardService(ElectionGuardianSetupRequest request) {
        try {
            String url = "http://host.docker.internal:5000/setup_guardians";
            // System.out.println("Trying to connect to backend...");
            // String response = webClient.get()
            //     .uri("http://host.docker.internal:5000/health") // 👈 Use host.docker.internal
            //     .retrieve()
            //     .bodyToMono(String.class)
            //     .block();
            // return "Backend response: " + response;
            System.out.println("Calling ElectionGuard service at: " + url);
            // HttpHeaders headers = new HttpHeaders();
            // headers.setContentType(MediaType.APPLICATION_JSON);

            // HttpEntity<ElectionGuardianSetupRequest> entity = new HttpEntity<>(request, headers);
            // ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            System.out.println("Sending request to ElectionGuard service: " + request);
            String response = webClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            System.out.println("Received response from ElectionGuard service: " + response);
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }
            return objectMapper.readValue(response, ElectionGuardianSetupResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }
}
