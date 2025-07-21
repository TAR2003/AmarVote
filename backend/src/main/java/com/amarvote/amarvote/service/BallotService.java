package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.CastBallotRequest;
import com.amarvote.amarvote.dto.CastBallotResponse;
import com.amarvote.amarvote.dto.ElectionGuardBallotRequest;
import com.amarvote.amarvote.dto.ElectionGuardBallotResponse;
import com.amarvote.amarvote.dto.EligibilityCheckRequest;
import com.amarvote.amarvote.dto.EligibilityCheckResponse;
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.UserRepository;
import com.amarvote.amarvote.utils.VoterIdGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BallotService {

    @Autowired
    private BallotRepository ballotRepository;
    
    @Autowired
    private ElectionRepository electionRepository;
    
    @Autowired
    private AllowedVoterRepository allowedVoterRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;
    
    @Autowired
    private GuardianRepository guardianRepository;
    
    @Autowired
    private WebClient webClient;
    
    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public CastBallotResponse castBallot(CastBallotRequest request, String userEmail) {
        try {
            // 1. Find user by email
            Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
            if (!userOpt.isPresent()) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("User not found")
                    .errorReason("Invalid user")
                    .build();
            }
            User user = userOpt.get();

            // 2. Find election
            Optional<Election> electionOpt = electionRepository.findById(request.getElectionId());
            if (!electionOpt.isPresent()) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .errorReason("Invalid election")
                    .build();
            }
            Election election = electionOpt.get();

            // 3. Check if election is active
            Instant now = Instant.now();
            if (now.isBefore(election.getStartingTime())) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("Election has not started yet")
                    .errorReason("Election not active")
                    .build();
            }
            if (now.isAfter(election.getEndingTime())) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("Election has ended")
                    .errorReason("Election ended")
                    .build();
            }

            // 4. Check eligibility
            boolean isEligible = checkVoterEligibility(user.getUserId(), election);
            if (!isEligible) {
                String errorMessage;
                String errorReason;
                
                if ("listed".equals(election.getEligibility())) {
                    errorMessage = "You are not eligible to vote in this election. You are not in the allowed voters list.";
                    errorReason = "Not in voter list for listed election";
                } else {
                    errorMessage = "You are not eligible to vote in this election due to unknown eligibility criteria.";
                    errorReason = "Unknown eligibility criteria";
                }
                
                return CastBallotResponse.builder()
                    .success(false)
                    .message(errorMessage)
                    .errorReason(errorReason)
                    .build();
            }

            // 5. Check if user has already voted
            if (hasUserAlreadyVoted(user.getUserId(), election.getElectionId())) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("You have already voted in this election")
                    .errorReason("Already voted")
                    .build();
            }

            // 6. Validate candidate choice
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionId(election.getElectionId());
            boolean isValidChoice = choices.stream()
                .anyMatch(choice -> choice.getOptionTitle().equals(request.getSelectedCandidate()));
            if (!isValidChoice) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("Invalid candidate selection")
                    .errorReason("Invalid candidate")
                    .build();
            }

            // 7. Generate ballot hash ID
            String ballotHashId = VoterIdGenerator.generateBallotHashId(user.getUserId(), election.getElectionId());

            // 8. Prepare data for ElectionGuard API
            List<String> partyNames = choices.stream()
                .map(ElectionChoice::getPartyName)
                .collect(Collectors.toList());
            List<String> candidateNames = choices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());

            // 9. Call ElectionGuard service
            ElectionGuardBallotResponse guardResponse = callElectionGuardService(
                partyNames, candidateNames, request.getSelectedCandidate(), 
                ballotHashId, election.getJointPublicKey(), election.getBaseHash(),
                election.getElectionQuorum(),
                guardianRepository.findByElectionId(election.getElectionId()).size()
            );

            if (guardResponse == null || !"success".equals(guardResponse.getStatus())) {
                return CastBallotResponse.builder()
                    .success(false)
                    .message("Failed to encrypt ballot")
                    .errorReason("Encryption failed")
                    .build();
            }

            // 10. Save ballot to database
            Ballot ballot = Ballot.builder()
                .electionId(election.getElectionId())
                .status("cast")
                .cipherText(guardResponse.getEncrypted_ballot())
                .hashCode(guardResponse.getBallot_hash())
                .trackingCode(ballotHashId)
                .submissionTime(Instant.now())
                .build();
            ballotRepository.save(ballot);

            // 11. Update voter status
            updateVoterStatus(user.getUserId(), election);

            // 12. Return success response
            return CastBallotResponse.builder()
                .success(true)
                .message("Ballot cast successfully")
                .hashCode(guardResponse.getBallot_hash())
                .trackingCode(ballotHashId)
                .build();

        } catch (Exception e) {
            return CastBallotResponse.builder()
                .success(false)
                .message("An error occurred while casting the ballot")
                .errorReason("Internal server error: " + e.getMessage())
                .build();
        }
    }

    /**
     * Check if a user is eligible to vote in a specific election
     * Returns comprehensive eligibility information including reasons for ineligibility
     */
    public EligibilityCheckResponse checkEligibility(EligibilityCheckRequest request, String userEmail) {
        try {
            // 1. Find user by email
            Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
            if (!userOpt.isPresent()) {
                return EligibilityCheckResponse.builder()
                    .eligible(false)
                    .message("User not found")
                    .reason("User account not found")
                    .hasVoted(false)
                    .isElectionActive(false)
                    .electionStatus("N/A")
                    .build();
            }
            User user = userOpt.get();

            // 2. Find election
            Optional<Election> electionOpt = electionRepository.findById(request.getElectionId());
            if (!electionOpt.isPresent()) {
                return EligibilityCheckResponse.builder()
                    .eligible(false)
                    .message("Election not found")
                    .reason("Election does not exist")
                    .hasVoted(false)
                    .isElectionActive(false)
                    .electionStatus("Not Found")
                    .build();
            }
            Election election = electionOpt.get();

            // 3. Check election status
            Instant now = Instant.now();
            String electionStatus;
            boolean isElectionActive = false;
            
            if (now.isBefore(election.getStartingTime())) {
                electionStatus = "Not Started";
            } else if (now.isAfter(election.getEndingTime())) {
                electionStatus = "Ended";
            } else {
                electionStatus = "Active";
                isElectionActive = true;
            }

            // 4. Check if user has already voted
            boolean hasVoted = hasUserAlreadyVoted(user.getUserId(), election.getElectionId());

            // 5. Check if user is eligible to vote
            boolean isEligible = checkVoterEligibility(user.getUserId(), election);

            // 6. Build comprehensive response
            String message;
            String reason;
            boolean overallEligible = false;

            if (hasVoted) {
                message = "You have already voted in this election";
                reason = "Already voted";
            } else if (!isEligible) {
                // More specific message based on election eligibility
                if ("listed".equals(election.getEligibility())) {
                    message = "You are not eligible to vote in this election. You are not in the allowed voters list.";
                    reason = "Not in voter list for listed election";
                } else {
                    message = "You are not eligible to vote in this election due to unknown eligibility criteria.";
                    reason = "Unknown eligibility criteria";
                }
            } else if (!isElectionActive) {
                if (electionStatus.equals("Not Started")) {
                    message = "Election has not started yet";
                    reason = "Election not active";
                } else {
                    message = "Election has ended";
                    reason = "Election ended";
                }
            } else {
                message = "You are eligible to vote";
                reason = "Eligible";
                overallEligible = true;
            }

            return EligibilityCheckResponse.builder()
                .eligible(overallEligible)
                .message(message)
                .reason(reason)
                .hasVoted(hasVoted)
                .isElectionActive(isElectionActive)
                .electionStatus(electionStatus)
                .build();

        } catch (Exception e) {
            return EligibilityCheckResponse.builder()
                .eligible(false)
                .message("Error checking eligibility")
                .reason("Internal server error: " + e.getMessage())
                .hasVoted(false)
                .isElectionActive(false)
                .electionStatus("Error")
                .build();
        }
    }

    private boolean checkVoterEligibility(Integer userId, Election election) {
        // Check eligibility type
        String eligibility = election.getEligibility();
        
        if ("unlisted".equals(eligibility)) {
            // For unlisted elections, anyone can vote
            return true;
        } else if ("listed".equals(eligibility)) {
            // For listed elections, only users in the allowed voters list can vote
            List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());
            return allowedVoters.stream()
                .anyMatch(av -> av.getUserId().equals(userId));
        }
        
        // Default behavior for unknown eligibility types - deny access
        return false;
    }

    private boolean hasUserAlreadyVoted(Integer userId, Long electionId) {
        // Check if user has an entry in allowed_voters table with hasVoted = true
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(electionId);
        
        return allowedVoters.stream()
            .anyMatch(av -> av.getUserId().equals(userId) && av.getHasVoted());
    }

    @Transactional
    private void updateVoterStatus(Integer userId, Election election) {
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());
        
        // Check if user already exists in allowed voters
        Optional<AllowedVoter> existingVoterOpt = allowedVoters.stream()
            .filter(av -> av.getUserId().equals(userId))
            .findFirst();
        
        if (existingVoterOpt.isPresent()) {
            // User already exists in allowed voters, just update hasVoted status
            AllowedVoter existingVoter = existingVoterOpt.get();
            existingVoter.setHasVoted(true);
            allowedVoterRepository.save(existingVoter);
        } else {
            // User doesn't exist in allowed voters
            if ("unlisted".equals(election.getEligibility())) {
                // For unlisted elections, add user to allowed voters with hasVoted = true
                AllowedVoter newVoter = AllowedVoter.builder()
                    .electionId(election.getElectionId())
                    .userId(userId)
                    .hasVoted(true)
                    .build();
                allowedVoterRepository.save(newVoter);
            } else {
                // For listed elections, user should already be in the list
                // This case shouldn't happen if eligibility check is working correctly
                System.err.println("Warning: User " + userId + " not found in allowed voters for listed election " + election.getElectionId());
            }
        }
    }

    private ElectionGuardBallotResponse callElectionGuardService(
            List<String> partyNames, List<String> candidateNames, String selectedCandidate,
            String ballotId, String jointPublicKey, String commitmentHash,
            int quorum, int numberOfGuardians) {
        
        try {
            String url = "/create_encrypted_ballot";
            
            ElectionGuardBallotRequest request = ElectionGuardBallotRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .candidate_name(selectedCandidate)
                .ballot_id(ballotId)
                .joint_public_key(jointPublicKey)
                .commitment_hash(commitmentHash)
                .number_of_guardians(numberOfGuardians)
                .quorum(quorum)
                .build();

            System.out.println("Calling ElectionGuard ballot service at: " + url);
            System.out.println("Sending request to ElectionGuard service: " + request);
            
            String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            
            System.out.println("Received response from ElectionGuard service: ");
            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            return objectMapper.readValue(response, ElectionGuardBallotResponse.class);
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }
}
