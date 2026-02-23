package com.amarvote.amarvote.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.BenalohChallengeRequest;
import com.amarvote.amarvote.dto.BenalohChallengeResponse;
import com.amarvote.amarvote.dto.BlockchainRecordBallotResponse;
import com.amarvote.amarvote.dto.CastBallotRequest;
import com.amarvote.amarvote.dto.CastBallotResponse;
import com.amarvote.amarvote.dto.CastEncryptedBallotRequest;
import com.amarvote.amarvote.dto.CreateEncryptedBallotRequest;
import com.amarvote.amarvote.dto.CreateEncryptedBallotResponse;
import com.amarvote.amarvote.dto.ElectionGuardBallotRequest;
import com.amarvote.amarvote.dto.ElectionGuardBallotResponse;
import com.amarvote.amarvote.dto.ElectionGuardBenalohRequest;
import com.amarvote.amarvote.dto.ElectionGuardBenalohResponse;
import com.amarvote.amarvote.dto.EligibilityCheckRequest;
import com.amarvote.amarvote.dto.EligibilityCheckResponse;
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
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
    private ElectionChoiceRepository electionChoiceRepository;

    @Autowired
    private GuardianRepository guardianRepository;

    @Autowired
    private ElectionGuardService electionGuardService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BlockchainService blockchainService;

    @Transactional
    public CastBallotResponse castBallot(CastBallotRequest request, String userEmail) {
        try {
            // 0. Validate bot detection data
            if (request.getBotDetection() != null) {
                CastBallotRequest.BotDetectionData botData = request.getBotDetection();

                // Check if bot detection indicates this is a bot
                if (botData.getIsBot() != null && botData.getIsBot()) {
                    System.out.println("🚨 [BACKEND BOT DETECTION] Bot detected for user: " + userEmail +
                            ", requestId: " + botData.getRequestId());
                    return CastBallotResponse.builder()
                            .success(false)
                            .message("Security check failed. Automated voting is not allowed.")
                            .errorReason("Bot detection failed")
                            .build();
                }

                // Check timestamp freshness (within last 5 minutes)
                if (botData.getTimestamp() != null) {
                    try {
                        Instant botDetectionTime = Instant.parse(botData.getTimestamp());
                        Instant now = Instant.now();
                        Duration timeDiff = Duration.between(botDetectionTime, now);

                        if (timeDiff.toMinutes() > 5) {
                            System.out.println(
                                    "⚠️ [BACKEND BOT DETECTION] Stale bot detection data for user: " + userEmail +
                                            ", age: " + timeDiff.toMinutes() + " minutes");
                            return CastBallotResponse.builder()
                                    .success(false)
                                    .message("Security check expired. Please try again.")
                                    .errorReason("Stale bot detection data")
                                    .build();
                        }

                        System.out.println("✅ [BACKEND BOT DETECTION] Valid bot detection for user: " + userEmail +
                                ", requestId: " + botData.getRequestId() +
                                ", isBot: " + botData.getIsBot());
                    } catch (Exception e) {
                        System.out
                                .println("⚠️ [BACKEND BOT DETECTION] Invalid timestamp format for user: " + userEmail);
                    }
                }
            } else {
                System.out.println("⚠️ [BACKEND BOT DETECTION] No bot detection data provided for user: " + userEmail);
                // Uncomment the lines below to make bot detection mandatory
                /*
                 * return CastBallotResponse.builder()
                 * .success(false)
                 * .message("Security verification required. Please refresh the page and try again."
                 * )
                 * .errorReason("No bot detection data")
                 * .build();
                 */
            }

            // 1. Find election
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
            boolean isEligible = checkVoterEligibility(userEmail, election);
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
            if (hasUserAlreadyVoted(userEmail, election.getElectionId())) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You have already voted in this election")
                        .errorReason("Already voted")
                        .build();
            }

            // 6. Validate candidate choice
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());

            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
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
            String ballotHashId = VoterIdGenerator.generateBallotHashId(userEmail, election.getElectionId());

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
                    guardianRepository.findByElectionId(election.getElectionId()).size());

            if (guardResponse == null || !"success".equals(guardResponse.getStatus())) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("Failed to encrypt ballot")
                        .errorReason("Encryption failed")
                        .build();
            }

            // 10. Save ballot to database
            // Store encrypted_ballot_with_nonce (binary transport / base64) which is required
            // by the tally service (from_binary_transport). encrypted_ballot is the sanitized
            // display version (JSON, nonces stripped) and cannot be tallied.
            String cipherTextToStore = guardResponse.getEncrypted_ballot_with_nonce() != null
                    ? guardResponse.getEncrypted_ballot_with_nonce()
                    : guardResponse.getEncrypted_ballot();
            Ballot ballot = Ballot.builder()
                    .electionId(election.getElectionId())
                    .status("cast")
                    .cipherText(cipherTextToStore)
                    .hashCode(guardResponse.getBallot_hash())
                    .trackingCode(ballotHashId)
                    .submissionTime(Instant.now())
                    .build();
            ballotRepository.save(ballot);

            // 🔗 Record ballot on blockchain
            try {
                BlockchainRecordBallotResponse blockchainResponse = blockchainService.recordBallot(
                        election.getElectionId().toString(),
                        ballotHashId,
                        guardResponse.getBallot_hash());
                if (blockchainResponse.isSuccess()) {
                    System.out.println("✅ Ballot " + ballotHashId + " successfully recorded on blockchain");
                    System.out.println("🔗 Transaction Hash: " + blockchainResponse.getTransactionHash());
                    System.out.println("📦 Block Number: " + blockchainResponse.getBlockNumber());
                } else {
                    System.err.println("⚠️ Failed to record ballot on blockchain: " + blockchainResponse.getMessage());
                    // Continue with ballot casting even if blockchain fails
                }
            } catch (Exception e) {
                System.err.println("⚠️ Error calling blockchain service: " + e.getMessage());
                // Continue with ballot casting even if blockchain fails
            }

            // 11. Update voter status
            updateVoterStatus(userEmail, election);

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
     * Returns comprehensive eligibility information including reasons for
     * ineligibility
     */
    public EligibilityCheckResponse checkEligibility(EligibilityCheckRequest request, String userEmail) {
        try {
            // 1. Find election
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
            boolean hasVoted = hasUserAlreadyVoted(userEmail, election.getElectionId());

            // 5. Check if user is eligible to vote
            boolean isEligible = checkVoterEligibility(userEmail, election);

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

    private boolean checkVoterEligibility(String userEmail, Election election) {
        // Check eligibility type
        String eligibility = election.getEligibility();

        if ("unlisted".equals(eligibility)) {
            // For unlisted elections, anyone can vote
            return true;
        } else if ("listed".equals(eligibility)) {
            // For listed elections, only users in the allowed voters list can vote
            List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());
            return allowedVoters.stream()
                    .anyMatch(av -> av.getUserEmail().equals(userEmail)); // Use userEmail, not userId
        }

        // Default behavior for unknown eligibility types - deny access
        return false;
    }

    /**
     * Get ballot details including cipher text by election ID and tracking code
     */
    public Map<String, Object> getBallotDetails(Long electionId, String trackingCode) {
        System.out.println("🔍 Searching for ballot details - Election: " + electionId + ", Tracking: " + trackingCode);

        try {
            // Search in the ballots table first
            Optional<Ballot> ballotOpt = ballotRepository.findByElectionIdAndTrackingCode(electionId, trackingCode);

            if (ballotOpt.isPresent()) {
                Ballot ballot = ballotOpt.get();
                System.out.println("✅ Ballot found in ballots table");

                Map<String, Object> ballotDetails = new HashMap<>();
                ballotDetails.put("election_id", ballot.getElectionId());
                ballotDetails.put("tracking_code", ballot.getTrackingCode());
                ballotDetails.put("hash_code", ballot.getHashCode());
                ballotDetails.put("cipher_text", ballot.getCipherText());
                ballotDetails.put("status", ballot.getStatus());
                ballotDetails.put("submission_time", ballot.getSubmissionTime().toString());
                ballotDetails.put("source", "ballots_table");

                return ballotDetails;
            } else {
                System.out.println("❌ Ballot not found in ballots table for tracking code: " + trackingCode);
                return null;
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error fetching ballot details: " + e.getMessage());
            throw new RuntimeException("Error fetching ballot details", e);
        }
    }

    private boolean hasUserAlreadyVoted(String userEmail, Long electionId) {
        // Check if user has an entry in allowed_voters table with hasVoted = true
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(electionId);

        return allowedVoters.stream()
                .anyMatch(av -> av.getUserEmail().equals(userEmail) && av.getHasVoted());
    }

    @Transactional
    private void updateVoterStatus(String userEmail, Election election) {
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());

        // Check if user already exists in allowed voters
        Optional<AllowedVoter> existingVoterOpt = allowedVoters.stream()
                .filter(av -> av.getUserEmail().equals(userEmail)) // Use userEmail instead of userId
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
                        .userEmail(userEmail) // Use userEmail, not userId
                        .hasVoted(true)
                        .build();
                allowedVoterRepository.save(newVoter);
            } else {
                // For listed elections, user should already be in the list
                // This case shouldn't happen if eligibility check is working correctly
                System.err.println("Warning: User " + userEmail + " not found in allowed voters for listed election "
                        + election.getElectionId());
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

            String response = electionGuardService.postRequest(url, request);

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

    /**
     * Maximum packet size for createEncryptedBallot request (in bytes)
     * This ensures all requests have the same size to prevent traffic analysis.
     */
    private static final int MAX_PACKET_SIZE = 4096; // 4KB should be sufficient
    
    /**
     * Validate and remove padding from the request to prevent traffic analysis.
     * This method ensures that padding exists (for security) and logs if it's missing,
     * then removes it before processing the actual ballot data.
     */
    private void validateAndRemovePadding(CreateEncryptedBallotRequest request) {
        if (request.getPadding() != null) {
            int paddingLength = request.getPadding().length();
            
            // Log padding statistics for monitoring (optional - can be removed in production)
            if (paddingLength < 100) {
                System.out.println("⚠️ [PADDING WARNING] Very short padding detected: " + paddingLength + " chars. Expected close to " + MAX_PACKET_SIZE + " bytes");
            }
            
            // Padding is valid, remove it for processing
            request.setPadding(null);
        }
        // If no padding exists, log a warning (should not happen in production)
        else {
            System.out.println("⚠️ [SECURITY WARNING] No padding detected in createEncryptedBallot request. " +
                    "This may indicate a security vulnerability or old client version.");
        }
    }
    
    /**
     * Create encrypted ballot without casting - for challenge/cast flow
     */
    @Transactional
    public CreateEncryptedBallotResponse createEncryptedBallot(CreateEncryptedBallotRequest request, String userEmail) {
        try {
            // 0a. Validate and remove padding (anti-traffic analysis)
            validateAndRemovePadding(request);
            // 0. Validate bot detection data (same as castBallot method)
            if (request.getBotDetection() != null) {
                CastBallotRequest.BotDetectionData botData = request.getBotDetection();

                if (botData.getIsBot() != null && botData.getIsBot()) {
                    System.out.println("🚨 [BACKEND BOT DETECTION] Bot detected for user: " + userEmail +
                            ", requestId: " + botData.getRequestId());
                    return CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("Security check failed. Automated voting is not allowed.")
                            .errorReason("Bot detection failed")
                            .build();
                }

                if (botData.getTimestamp() != null) {
                    try {
                        Instant botDetectionTime = Instant.parse(botData.getTimestamp());
                        Instant now = Instant.now();
                        Duration timeDiff = Duration.between(botDetectionTime, now);

                        if (timeDiff.toMinutes() > 5) {
                            System.out.println(
                                    "⚠️ [BACKEND BOT DETECTION] Stale bot detection data for user: " + userEmail +
                                            ", age: " + timeDiff.toMinutes() + " minutes");
                            return CreateEncryptedBallotResponse.builder()
                                    .success(false)
                                    .message("Security check expired. Please try again.")
                                    .errorReason("Stale bot detection data")
                                    .build();
                        }

                        System.out.println("✅ [BACKEND BOT DETECTION] Valid bot detection for user: " + userEmail +
                                ", requestId: " + botData.getRequestId());

                    } catch (Exception e) {
                        System.err.println("⚠️ [BACKEND BOT DETECTION] Error parsing bot detection timestamp: " + e.getMessage());
                        return CreateEncryptedBallotResponse.builder()
                                .success(false)
                                .message("Invalid security check data. Please try again.")
                                .errorReason("Invalid bot detection timestamp")
                                .build();
                    }
                }
            }

            // 1. Find election
            Optional<Election> electionOpt = electionRepository.findById(request.getElectionId());
            if (!electionOpt.isPresent()) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Election not found")
                        .errorReason("Invalid election")
                        .build();
            }
            Election election = electionOpt.get();

            // 3. Check if election is active
            Instant now = Instant.now();
            if (now.isBefore(election.getStartingTime())) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Election has not started yet")
                        .errorReason("Election not active")
                        .build();
            }
            if (now.isAfter(election.getEndingTime())) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Election has ended")
                        .errorReason("Election ended")
                        .build();
            }

            // 4. Check eligibility
            boolean isEligible = checkVoterEligibility(userEmail, election);
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

                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message(errorMessage)
                        .errorReason(errorReason)
                        .build();
            }

            // 5. Check if user has already voted
            if (hasUserAlreadyVoted(userEmail, election.getElectionId())) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("You have already voted in this election")
                        .errorReason("Already voted")
                        .build();
            }

            // 6. Validate candidate choice
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            boolean isValidChoice = choices.stream()
                    .anyMatch(choice -> choice.getOptionTitle().equals(request.getSelectedCandidate()));
            if (!isValidChoice) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Invalid candidate selection")
                        .errorReason("Invalid candidate")
                        .build();
            }

            // 7. Generate ballot hash ID
            String ballotHashId = VoterIdGenerator.generateBallotHashId(userEmail, election.getElectionId());

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
                    guardianRepository.findByElectionId(election.getElectionId()).size());

            if (guardResponse == null || !"success".equals(guardResponse.getStatus())) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Failed to encrypt ballot")
                        .errorReason("Encryption failed")
                        .build();
            }

            // 10. Return encrypted ballot details (do not save to database yet)
            return CreateEncryptedBallotResponse.builder()
                    .success(true)
                    .message("Encrypted ballot created successfully")
                    .encrypted_ballot(guardResponse.getEncrypted_ballot())
                    .encrypted_ballot_with_nonce(guardResponse.getEncrypted_ballot_with_nonce())
                    .ballot_hash(guardResponse.getBallot_hash())
                    .ballot_tracking_code(ballotHashId)
                    .ballot_id(guardResponse.getBallot_id())
                    .build();

        } catch (Exception e) {
            return CreateEncryptedBallotResponse.builder()
                    .success(false)
                    .message("An error occurred while creating the encrypted ballot")
                    .errorReason("Internal server error: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Perform Benaloh challenge verification
     */
    @Transactional
    public BenalohChallengeResponse performBenalohChallenge(BenalohChallengeRequest request, String userEmail) {
        try {
            System.out.println("🔍 [BENALOH] Starting Benaloh challenge for user: " + userEmail);
            System.out.println("🔍 [BENALOH] Request data: electionId=" + request.getElectionId() + 
                              ", candidate=" + request.getCandidate_name());

            // 1. Find election
            Optional<Election> electionOpt = electionRepository.findById(request.getElectionId());
            if (!electionOpt.isPresent()) {
                System.out.println("❌ [BENALOH] Election not found");
                return BenalohChallengeResponse.builder()
                        .success(false)
                        .message("Election not found")
                        .errorReason("Invalid election")
                        .build();
            }
            Election election = electionOpt.get();
            System.out.println("✅ [BENALOH] Election found: " + election.getElectionTitle());

            // 2. Validate candidate choice
            System.out.println("🔍 [BENALOH] Fetching election choices...");
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            System.out.println("🔍 [BENALOH] Found " + choices.size() + " choices");
            
            for (ElectionChoice choice : choices) {
                System.out.println("🔍 [BENALOH] Choice: " + choice.getOptionTitle());
            }
            
            boolean isValidChoice = choices.stream()
                    .anyMatch(choice -> choice.getOptionTitle().equals(request.getCandidate_name()));
            System.out.println("🔍 [BENALOH] Is valid choice: " + isValidChoice + " for candidate: " + request.getCandidate_name());
            
            if (!isValidChoice) {
                System.out.println("❌ [BENALOH] Invalid candidate selection");
                return BenalohChallengeResponse.builder()
                        .success(false)
                        .message("Invalid candidate selection for verification")
                        .errorReason("Invalid candidate")
                        .build();
            }

            // 4. Prepare data for ElectionGuard Benaloh challenge API
            System.out.println("🔍 [BENALOH] Preparing data for microservice call...");
            List<String> partyNames = choices.stream()
                    .map(ElectionChoice::getPartyName)
                    .collect(Collectors.toList());
            List<String> candidateNames = choices.stream()
                    .map(ElectionChoice::getOptionTitle)
                    .collect(Collectors.toList());

            String ballotId = "challenge-" + userEmail.hashCode() + "-" + election.getElectionId() + "-" + System.currentTimeMillis();
            System.out.println("🔍 [BENALOH] Ballot ID: " + ballotId);
            System.out.println("🔍 [BENALOH] Party names: " + partyNames);
            System.out.println("🔍 [BENALOH] Candidate names: " + candidateNames);

            // 5. Call ElectionGuard Benaloh challenge service
            System.out.println("📞 [BENALOH] Calling ElectionGuard Benaloh service...");
            ElectionGuardBenalohResponse guardResponse = callElectionGuardBenalohService(
                    partyNames, candidateNames, request.getCandidate_name(),
                    ballotId, election.getJointPublicKey(), election.getBaseHash(),
                    election.getElectionQuorum(),
                    guardianRepository.findByElectionId(election.getElectionId()).size(),
                    request.getEncrypted_ballot_with_nonce());
            System.out.println("📞 [BENALOH] Received response from ElectionGuard service");

            if (guardResponse == null || !"success".equals(guardResponse.getStatus())) {
                return BenalohChallengeResponse.builder()
                        .success(false)
                        .message("Failed to perform Benaloh challenge")
                        .errorReason("Challenge verification failed")
                        .build();
            }

            // 6. Return challenge result
            String message;
            if (guardResponse.isMatch()) {
                message = "✅ Ballot verification successful! The encrypted ballot was created with your selected choice: " + guardResponse.getVerified_candidate();
            } else {
                message = "❌ WARNING: Ballot verification failed! The encrypted ballot does NOT match your selected choice. " +
                         "This indicates a potential security issue. Please contact the election administrators immediately.";
            }

            return BenalohChallengeResponse.builder()
                    .success(true)
                    .message(message)
                    .match(guardResponse.isMatch())
                    .verified_candidate(guardResponse.getVerified_candidate())
                    .expected_candidate(guardResponse.getExpected_candidate())
                    .ballot_id(guardResponse.getBallot_id())
                    .build();

        } catch (Exception e) {
            return BenalohChallengeResponse.builder()
                    .success(false)
                    .message("An error occurred during Benaloh challenge verification")
                    .errorReason("Internal server error: " + e.getMessage())
                    .build();
        }
    }

    private ElectionGuardBenalohResponse callElectionGuardBenalohService(
            List<String> partyNames, List<String> candidateNames, String selectedCandidate,
            String ballotId, String jointPublicKey, String commitmentHash,
            int quorum, int numberOfGuardians, String encryptedBallotWithNonce) {

        try {
            System.out.println("🌐 [BENALOH API] Starting microservice call...");
            String url = "/benaloh_challenge";
            System.out.println("🌐 [BENALOH API] URL: " + url);

            ElectionGuardBenalohRequest request = ElectionGuardBenalohRequest.builder()
                    .party_names(partyNames)
                    .candidate_names(candidateNames)
                    .candidate_name(selectedCandidate)
                    .ballot_id(ballotId)
                    .joint_public_key(jointPublicKey)
                    .commitment_hash(commitmentHash)
                    .number_of_guardians(numberOfGuardians)
                    .quorum(quorum)
                    .encrypted_ballot_with_nonce(encryptedBallotWithNonce)
                    .build();

            System.out.println("🌐 [BENALOH API] Request built successfully");
            System.out.println("Calling ElectionGuard Benaloh challenge service at: " + url);
            System.out.println("Sending request to ElectionGuard Benaloh service: " + request);

            System.out.println("🌐 [BENALOH API] Making ElectionGuardService call...");
            String response = electionGuardService.postRequest(url, request);

            System.out.println("Received response from ElectionGuard Benaloh service: ");

            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard Benaloh service");
            }

            return objectMapper.readValue(response, ElectionGuardBenalohResponse.class);
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard Benaloh service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard Benaloh service", e);
        }
    }

    /**
     * Cast a pre-encrypted ballot
     */
    @Transactional
    public CastBallotResponse castEncryptedBallot(CastEncryptedBallotRequest request, String userEmail) {
        try {
            // 1. Find election
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
            boolean isEligible = checkVoterEligibility(userEmail, election);
            if (!isEligible) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You are not eligible to vote in this election")
                        .errorReason("Not eligible")
                        .build();
            }

            // 5. Check if user has already voted
            if (hasUserAlreadyVoted(userEmail, election.getElectionId())) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You have already voted in this election")
                        .errorReason("Already voted")
                        .build();
            }

            // 6. Save ballot to database
            Ballot ballot = Ballot.builder()
                    .electionId(election.getElectionId())
                    .status("cast")
                    .cipherText(request.getEncrypted_ballot())
                    .hashCode(request.getBallot_hash())
                    .trackingCode(request.getBallot_tracking_code())
                    .submissionTime(Instant.now())
                    .build();
            ballotRepository.save(ballot);

            // 7. Record ballot on blockchain
            try {
                BlockchainRecordBallotResponse blockchainResponse = blockchainService.recordBallot(
                        election.getElectionId().toString(),
                        request.getBallot_tracking_code(),
                        request.getBallot_hash());
                if (blockchainResponse.isSuccess()) {
                    System.out.println("✅ Ballot " + request.getBallot_tracking_code() + " successfully recorded on blockchain");
                    System.out.println("🔗 Transaction Hash: " + blockchainResponse.getTransactionHash());
                    System.out.println("📦 Block Number: " + blockchainResponse.getBlockNumber());
                } else {
                    System.err.println("⚠️ Failed to record ballot on blockchain: " + blockchainResponse.getMessage());
                }
            } catch (Exception e) {
                System.err.println("⚠️ Error calling blockchain service: " + e.getMessage());
            }

            // 8. Update voter status
            updateVoterStatus(userEmail, election);

            // 9. Return success response
            return CastBallotResponse.builder()
                    .success(true)
                    .message("Ballot cast successfully")
                    .hashCode(request.getBallot_hash())
                    .trackingCode(request.getBallot_tracking_code())
                    .build();

        } catch (Exception e) {
            return CastBallotResponse.builder()
                    .success(false)
                    .message("An error occurred while casting the ballot")
                    .errorReason("Internal server error: " + e.getMessage())
                    .build();
        }
    }
}

