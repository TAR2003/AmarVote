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
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
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
                return CastBallotResponse.builder()
                    .success(false)
                    .message("You are not eligible to vote in this election")
                    .errorReason("Not eligible to vote")
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
                ballotHashId, election.getJointPublicKey(), election.getBaseHash()
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

    private boolean checkVoterEligibility(Integer userId, Election election) {
        // Check if user is in allowed voters list
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());
        
        // If it's a public election (empty voter list), user is eligible
        if (allowedVoters.isEmpty()) {
            return true; // Public election - anyone can vote
        }
        
        // Check if user is in the allowed voters list
        return allowedVoters.stream()
            .anyMatch(av -> av.getUserId().equals(userId));
    }

    private boolean hasUserAlreadyVoted(Integer userId, Long electionId) {
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(electionId);
        
        return allowedVoters.stream()
            .anyMatch(av -> av.getUserId().equals(userId) && av.getHasVoted());
    }

    @Transactional
    private void updateVoterStatus(Integer userId, Election election) {
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());
        
        // If it's a public election (empty voter list), add user to allowed voters
        if (allowedVoters.isEmpty()) {
            AllowedVoter newVoter = AllowedVoter.builder()
                .electionId(election.getElectionId())
                .userId(userId)
                .hasVoted(true)
                .build();
            allowedVoterRepository.save(newVoter);
        } else {
            // Update existing allowed voter
            Optional<AllowedVoter> voterOpt = allowedVoters.stream()
                .filter(av -> av.getUserId().equals(userId))
                .findFirst();
            
            if (voterOpt.isPresent()) {
                AllowedVoter voter = voterOpt.get();
                voter.setHasVoted(true);
                allowedVoterRepository.save(voter);
            }
        }
    }

    private ElectionGuardBallotResponse callElectionGuardService(
            List<String> partyNames, List<String> candidateNames, String selectedCandidate,
            String ballotId, String jointPublicKey, String commitmentHash) {
        
        try {
            String url = "/create_encrypted_ballot";
            
            ElectionGuardBallotRequest request = ElectionGuardBallotRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .candidate_name(selectedCandidate)
                .ballot_id(ballotId)
                .joint_public_key(jointPublicKey)
                .commitment_hash(commitmentHash)
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
