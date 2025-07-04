package com.amarvote.amarvote.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PartialDecryptionService {

    private final UserRepository userRepository;
    private final GuardianRepository guardianRepository;
    private final ElectionRepository electionRepository;
    private final ElectionChoiceRepository electionChoiceRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final ObjectMapper objectMapper;
    
    @Autowired
    private WebClient webClient;

    @Transactional
    public CreatePartialDecryptionResponse createPartialDecryption(CreatePartialDecryptionRequest request, String userEmail) {
        try {
            // 1. Find user by email
            Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
            if (!userOpt.isPresent()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("User not found")
                    .build();
            }
            // 2. Find guardian record for this user and election
            List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(request.election_id(), userEmail);
            if (guardians.isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("User is not a guardian for this election")
                    .build();
            }
            Guardian guardian = guardians.get(0); // Should be only one

            // 3. Get election information
            Optional<Election> electionOpt = electionRepository.findById(request.election_id());
            if (!electionOpt.isPresent()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            Election election = electionOpt.get();

            // 4. Get election choices for candidate names and party names
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionId(request.election_id());
            List<String> candidateNames = choices.stream()
                .map(ElectionChoice::getOptionTitle)
                .toList();
            List<String> partyNames = choices.stream()
                .map(ElectionChoice::getPartyName)
                .toList();

            // 5. Get number of guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
            int numberOfGuardians = allGuardians.size();

            // 6. Get submitted ballots for this election
            List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionId(request.election_id());
            List<String> ballotCipherTexts = submittedBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .toList();

            // 7. Parse the encrypted tally JSON from database
            Object ciphertextTallyObject = null;
            try {
                if (election.getEncryptedTally() != null && !election.getEncryptedTally().trim().isEmpty()) {
                    ciphertextTallyObject = objectMapper.readValue(election.getEncryptedTally(), Object.class);
                }
            } catch (Exception e) {
                System.err.println("Failed to parse encrypted tally JSON: " + e.getMessage());
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to parse encrypted tally data")
                    .build();
            }

            // 8. Call ElectionGuard microservice
            ElectionGuardPartialDecryptionRequest guardRequest = ElectionGuardPartialDecryptionRequest.builder()
                .guardian_id(String.valueOf(guardian.getSequenceOrder()))
                .sequence_order(guardian.getSequenceOrder())
                .guardian_public_key(guardian.getGuardianPublicKey())
                .guardian_private_key(request.key())
                .guardian_polynomial(guardian.getGuardianPolynomial())
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .ciphertext_tally(ciphertextTallyObject)
                .status("success")
                .submitted_ballots(ballotCipherTexts)
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .number_of_guardians(numberOfGuardians)
                .build();

            ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);

            // 9. Check if tally_share is null (invalid key)
            if (guardResponse.tally_share() == null) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("The key you provided was not right, please provide the right key")
                    .build();
            }

            // 10. Update guardian record with response data
            // Serialize ballot_shares Object to JSON string for database storage
            String ballotSharesJson = null;
            try {
                if (guardResponse.ballot_shares() != null) {
                    ballotSharesJson = objectMapper.writeValueAsString(guardResponse.ballot_shares());
                }
            } catch (Exception e) {
                System.err.println("Failed to serialize ballot_shares: " + e.getMessage());
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to serialize ballot shares data")
                    .build();
            }

            guardian.setPartialDecryptedTally(ballotSharesJson);
            guardian.setGuardianDecryptionKey(guardResponse.guardian_public_key());
            guardian.setTallyShare(guardResponse.tally_share());
            guardianRepository.save(guardian);

            return CreatePartialDecryptionResponse.builder()
                .success(true)
                .message("Partial decryption completed successfully")
                .build();

        } catch (Exception e) {
            System.err.println("Error creating partial decryption: " + e.getMessage());
            return CreatePartialDecryptionResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }

    private ElectionGuardPartialDecryptionResponse callElectionGuardPartialDecryptionService(
            ElectionGuardPartialDecryptionRequest request) {
        
        try {
            String url = "/create_partial_decryption";
            
            System.out.println("Calling ElectionGuard partial decryption service at: " + url);
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

            return objectMapper.readValue(response, ElectionGuardPartialDecryptionResponse.class);
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard partial decryption service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard partial decryption service", e);
        }
    }
}
