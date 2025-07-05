package com.amarvote.amarvote.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.CombinePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionResponse;
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
            
            // Mark guardian as having completed decryption
            guardian.setDecryptedOrNot(true);
            
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

    @Transactional
    public CombinePartialDecryptionResponse combinePartialDecryption(CombinePartialDecryptionRequest request) {
        try {
            // 1. Fetch election
            Optional<Election> electionOpt = electionRepository.findById(request.election_id());
            if (!electionOpt.isPresent()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            Election election = electionOpt.get();

            // 2. Check if ciphertext_tally exists
            if (election.getEncryptedTally() == null || election.getEncryptedTally().trim().isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election tally has not been created yet. Please create the tally first.")
                    .build();
            }

            // 3. Fetch election choices for candidate_names and party_names
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionId(request.election_id());
            if (electionChoices.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("No election choices found for this election")
                    .build();
            }

            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .filter(partyName -> partyName != null && !partyName.trim().isEmpty())
                .distinct()
                .collect(Collectors.toList());

            // 4. Fetch submitted ballots
            List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionId(request.election_id());
            List<String> ballotCipherTexts = submittedBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .collect(Collectors.toList());

            // 5. Fetch all guardians for this election
            List<Guardian> guardians = guardianRepository.findByElectionId(request.election_id());
            if (guardians.isEmpty()) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("No guardians found for this election")
                    .build();
            }

            // 6. Check if all guardians have completed their partial decryption
            for (Guardian guardian : guardians) {
                if (guardian.getTallyShare() == null || guardian.getTallyShare().trim().isEmpty()) {
                    return CombinePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Sorry, all guardians have not yet decrypted their shares. Please ensure all guardians complete their partial decryption first.")
                        .build();
                }
            }

            // 7. Extract guardian data
            List<String> guardianPublicKeys = guardians.stream()
                .map(Guardian::getGuardianDecryptionKey)
                .collect(Collectors.toList());
            
            List<String> tallyShares = guardians.stream()
                .map(Guardian::getTallyShare)
                .collect(Collectors.toList());
            
            List<Object> ballotShares = guardians.stream()
                .map(guardian -> {
                    try {
                        if (guardian.getPartialDecryptedTally() != null && !guardian.getPartialDecryptedTally().trim().isEmpty()) {
                            return objectMapper.readValue(guardian.getPartialDecryptedTally(), Object.class);
                        }
                        return null;
                    } catch (Exception e) {
                        System.err.println("Failed to parse partial decrypted tally for guardian: " + e.getMessage());
                        return null;
                    }
                })
                .collect(Collectors.toList());

            // 8. Parse the encrypted tally JSON from database
            Object ciphertextTallyObject = null;
            try {
                ciphertextTallyObject = objectMapper.readValue(election.getEncryptedTally(), Object.class);
            } catch (Exception e) {
                System.err.println("Failed to parse encrypted tally JSON: " + e.getMessage());
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to parse encrypted tally data")
                    .build();
            }

            // 9. Call ElectionGuard microservice
            ElectionGuardCombineDecryptionRequest guardRequest = ElectionGuardCombineDecryptionRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .ciphertext_tally(ciphertextTallyObject)
                .submitted_ballots(ballotCipherTexts)
                .guardian_public_keys(guardianPublicKeys)
                .tally_shares(tallyShares)
                .ballot_shares(ballotShares)
                .build();

            ElectionGuardCombineDecryptionResponse guardResponse = callElectionGuardCombineDecryptionService(guardRequest);

            // 10. Update election results in database and return response
            if ("success".equals(guardResponse.status())) {
                // Update the total_votes in election_choices table
                updateElectionChoicesWithResults(request.election_id(), guardResponse.results(), electionChoices);
                
                // Update election status to 'decrypted'
                election.setStatus("decrypted");
                electionRepository.save(election);
                System.out.println("Updated election status to 'decrypted' for election: " + request.election_id());
                
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Partial decryption combined successfully")
                    .results(guardResponse.results())
                    .build();
            } else {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to combine partial decryption: " + guardResponse.message())
                    .build();
            }

        } catch (Exception e) {
            System.err.println("Error combining partial decryption: " + e.getMessage());
            return CombinePartialDecryptionResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }

    private ElectionGuardCombineDecryptionResponse callElectionGuardCombineDecryptionService(
            ElectionGuardCombineDecryptionRequest request) {
        
        try {
            String url = "/combine_partial_decryption";
            
            System.out.println("Calling ElectionGuard combine decryption service at: " + url);
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

            return objectMapper.readValue(response, ElectionGuardCombineDecryptionResponse.class);
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard combine decryption service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard combine decryption service", e);
        }
    }

    private void updateElectionChoicesWithResults(Long electionId, Object results, List<ElectionChoice> electionChoices) {
        try {
            System.out.println("Updating election choices with vote results for election: " + electionId);
            
            // Parse the results object to extract vote counts
            @SuppressWarnings("unchecked")
            Map<String, Object> resultsMap = (Map<String, Object>) results;
            
            @SuppressWarnings("unchecked")
            Map<String, Object> resultsSection = (Map<String, Object>) resultsMap.get("results");
            
            if (resultsSection == null) {
                System.err.println("No 'results' section found in the response");
                return;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> candidates = (Map<String, Object>) resultsSection.get("candidates");
            
            if (candidates == null) {
                System.err.println("No 'candidates' section found in results");
                return;
            }
            
            // Update each election choice with its vote count
            for (ElectionChoice choice : electionChoices) {
                String candidateName = choice.getOptionTitle();
                
                @SuppressWarnings("unchecked")
                Map<String, Object> candidateData = (Map<String, Object>) candidates.get(candidateName);
                
                if (candidateData != null) {
                    Object votesObj = candidateData.get("votes");
                    if (votesObj != null) {
                        try {
                            // Handle both String and Integer vote counts
                            int voteCount;
                            if (votesObj instanceof String) {
                                voteCount = Integer.parseInt((String) votesObj);
                            } else if (votesObj instanceof Integer) {
                                voteCount = (Integer) votesObj;
                            } else {
                                voteCount = 0;
                                System.err.println("Unexpected vote type for candidate " + candidateName + ": " + votesObj.getClass());
                            }
                            
                            choice.setTotalVotes(voteCount);
                            System.out.println("Updated votes for candidate '" + candidateName + "': " + voteCount);
                        } catch (NumberFormatException e) {
                            System.err.println("Failed to parse vote count for candidate " + candidateName + ": " + votesObj);
                            choice.setTotalVotes(0);
                        }
                    } else {
                        System.err.println("No vote count found for candidate: " + candidateName);
                        choice.setTotalVotes(0);
                    }
                } else {
                    System.err.println("No data found for candidate: " + candidateName);
                    choice.setTotalVotes(0);
                }
            }
            
            // Save all updated election choices
            electionChoiceRepository.saveAll(electionChoices);
            System.out.println("Successfully updated " + electionChoices.size() + " election choices with vote counts");
            
        } catch (Exception e) {
            System.err.println("Error updating election choices with results: " + e.getMessage());
            e.printStackTrace();
            // Don't throw the exception here as we still want to return the results to frontend
        }
    }
}
