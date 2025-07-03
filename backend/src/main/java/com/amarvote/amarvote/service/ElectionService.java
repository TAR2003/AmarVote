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
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.UserRepository;
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

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GuardianRepository guardianRepository;

    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;

    @Autowired
    private AllowedVoterRepository allowedVoterRepository;

    @Transactional
    public Election createElection(ElectionCreationRequest request, String jwtToken, String userEmail) {
        // Log the received token and email
        System.out.println("=========== ELECTION SERVICE ===========");
        System.out.println("Received JWT Token: " + jwtToken);
        System.out.println("Received User Email: " + userEmail);
        System.out.println("========================================");

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
                Integer.parseInt(request.guardianNumber()),
                Integer.parseInt(request.guardianNumber()),
                request.partyNames(),
                request.candidateNames()
        );

        ElectionGuardianSetupResponse guardianResponse = callElectionGuardService(guardianRequest);

        // Create and save election FIRST to generate electionId
        Election election = new Election();
        election.setElectionTitle(request.electionTitle());
        election.setElectionDescription(request.electionDescription());
        election.setNumberOfGuardians(guardianRequest.number_of_guardians());
        election.setElectionQuorum(guardianRequest.quorum());
        election.setNoOfCandidates(request.candidateNames().size());
        election.setJointPublicKey(guardianResponse.joint_public_key());
        election.setManifestHash(guardianResponse.manifest());
        election.setStatus("draft");
        election.setStartingTime(request.startingTime());
        election.setEndingTime(request.endingTime());
        election.setBaseHash(guardianResponse.commitment_hash());
        election.setAdminEmail(userEmail); // Set admin email from request

        // ✅ Save to DB to get generated ID
        election = electionRepository.save(election);

        // Validate guardian email and private key count
        List<String> guardianEmails = request.guardianEmails();
        List<String> guardianPrivateKeys = guardianResponse.guardian_private_keys();
        if (guardianEmails.size() != guardianPrivateKeys.size()) {
            throw new IllegalArgumentException("Guardian emails and private keys count must match");
        }

        // Send private key emails
        for (int i = 0; i < guardianEmails.size(); i++) {
            String email = guardianEmails.get(i);
            String privateKey = guardianPrivateKeys.get(i);

            if (!userRepository.existsByUserEmail(email)) {
                throw new RuntimeException("User not found for email: " + email);
            }

            emailService.sendGuardianPrivateKeyEmail(email, privateKey, election.getElectionTitle());
        }

        System.out.println("Guardian Private Keys:");
        for (int i = 0; i < guardianPrivateKeys.size(); i++) {
            System.out.printf("Guardian %d (%s) Private Key: %s%n", i + 1, guardianEmails.get(i), guardianPrivateKeys.get(i));
        }

        System.out.println("Email sent to guardians with their private keys.");

        // Now save Guardian objects
        List<String> guardianPublicKeys = guardianResponse.guardian_public_keys();
        List<String> guardianPolynomials = guardianResponse.guardian_polynomials();

        for (int i = 0; i < guardianEmails.size(); i++) {
            String email = guardianEmails.get(i);

            Integer userId = userRepository.findByUserEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found for email: " + email))
                    .getUserId();
            // System.out.println("id pabo");
            int id = election.getElectionId().intValue();
            // System.out.println("id paise");

            Guardian guardian = Guardian.builder()
                    .electionId(election.getElectionId()) // Now safely use
                    .userId(userId)
                    .guardianPublicKey(guardianPublicKeys.get(i))
                    .guardianPolynomial(guardianPolynomials.get(i))
                    .sequenceOrder(i + 1)
                    .decryptedOrNot(false)
                    .partialDecryptedTally(null)
                    .proof(null)
                    .build();

            guardianRepository.save(guardian);
        }

        System.out.println("Guardians saved successfully.");

        List<String> candidateNames = request.candidateNames();
        List<String> partyNames = request.partyNames();
        List<String> candidatePictures = request.candidatePictures();
        List<String> partyPictures = request.partyPictures();

        for (int i = 0; i < candidateNames.size(); i++) {
            String candidateName = candidateNames.get(i);
            String partyName = (i < partyNames.size()) ? partyNames.get(i) : null;
            String candidatePic = (candidatePictures != null && i < candidatePictures.size()) ? candidatePictures.get(i) : null;
            String partyPic = (partyPictures != null && i < partyPictures.size()) ? partyPictures.get(i) : null;

            ElectionChoice choice = ElectionChoice.builder()
                    .electionId(election.getElectionId())
                    .optionTitle(candidateName)
                    .optionDescription(null) // or some logic to provide description
                    .partyName(partyName)
                    .candidatePic(candidatePic)
                    .partyPic(partyPic)
                    .totalVotes(0)
                    .build();

            electionChoiceRepository.save(choice);
        }

        System.out.println("Election choices saved successfully.");

        List<String> voterEmails = request.voterEmails();

        for (String email : voterEmails) {
            Integer userId = userRepository.findByUserEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found for voter email: " + email))
                    .getUserId();

            AllowedVoter allowedVoter = AllowedVoter.builder()
                    .electionId(election.getElectionId())
                    .userId(userId)
                    .hasVoted(false)
                    .build();

            allowedVoterRepository.save(allowedVoter);
        }

        System.out.println("Allowed voters saved successfully.");

        return election;
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
            // System.out.println("Sending request to ElectionGuard service: " + request);
            String response = webClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            // System.out.println("Received response from ElectionGuard service: " + response);
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }
            return objectMapper.readValue(response, ElectionGuardianSetupResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }
}
