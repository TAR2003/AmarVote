package com.amarvote.amarvote.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.BenalohChallengeRequest;
import com.amarvote.amarvote.dto.BenalohChallengeResponse;
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
import com.amarvote.amarvote.dto.worker.VoteReceiptTask;
import com.amarvote.amarvote.exception.ElectionGuardCapacityException;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.utils.VoterIdGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BallotService {

    @Autowired
    private BallotRepository ballotRepository;

    @Autowired
    private ElectionRepository electionRepository;

    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;

    @Autowired
    private GuardianRepository guardianRepository;

    @Autowired
    private ElectionGuardService electionGuardService;

    @Autowired
    private ObjectMapper objectMapper;

    // @Autowired
    // private BlockchainService blockchainService;

    @Autowired
    private BallotCastPersistenceService ballotCastPersistenceService;

    @Autowired
    private VoterEligibilityResolver voterEligibilityResolver;

    @Autowired
    private TaskPublisherService taskPublisherService;

    @Autowired
    private VoteReceiptService voteReceiptService;

    public CastBallotResponse castBallot(CastBallotRequest request, String userEmail, String siteBaseUrl) {
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

            Optional<CastBallotResponse> notReady = rejectCastIfElectionNotReady(election);
            if (notReady.isPresent()) {
                return notReady.get();
            }

            // 4. Check eligibility (single indexed voter lookup)
            VoterEligibilityResolver.Snapshot voter = voterEligibilityResolver.resolve(userEmail, election);
            if (!voter.isEligibleToVote(election)) {
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
            if (voter.hasVoted()) {
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
            Integer electionMaxChoices = election.getMaxChoices();
            int maxChoicesCast = (electionMaxChoices != null) ? electionMaxChoices : 1;

            // 9. Call ElectionGuard service
            ElectionGuardBallotResponse guardResponse = callElectionGuardService(
                    partyNames, candidateNames, List.of(request.getSelectedCandidate()),
                    ballotHashId, election.getJointPublicKey(), election.getBaseHash(),
                    election.getElectionQuorum(),
                    guardianRepository.countByElectionId(election.getElectionId()),
                    maxChoicesCast);

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
            BallotCastPersistenceService.CastPersistOutcome persistOutcome =
                    ballotCastPersistenceService.persistCast(ballot, userEmail, election);
            if (persistOutcome == BallotCastPersistenceService.CastPersistOutcome.ALREADY_VOTED) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You have already voted in this election")
                        .errorReason("Already voted")
                        .build();
            }
            if (persistOutcome == BallotCastPersistenceService.CastPersistOutcome.NOT_ELIGIBLE) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You are not eligible to vote in this election")
                        .errorReason("Not eligible")
                        .build();
            }

            // Blockchain disabled (blockchain.enabled=false) — ballot is persisted in Postgres only.
            // blockchainService.recordBallotAsync(
            //         election.getElectionId().toString(),
            //         ballotHashId,
            //         guardResponse.getBallot_hash());

            queueVoteReceiptEmail(
                    userEmail,
                    election,
                    guardResponse.getBallot_hash(),
                    ballotHashId,
                    request.getSelectedCandidate(),
                    findPartyForCandidate(choices, request.getSelectedCandidate()),
                    siteBaseUrl);

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
    @Transactional(readOnly = true)
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

            Optional<String> activationBlock = ElectionVoteReadiness.activationBlockReason(election);
            if (activationBlock.isPresent()) {
                String reason = activationBlock.get();
                String message = "Election not scheduled".equals(reason)
                        ? "Election schedule is not set yet"
                        : "Election is not activated yet. Key ceremony is incomplete.";
                return EligibilityCheckResponse.builder()
                    .eligible(false)
                    .message(message)
                    .reason(reason)
                    .hasVoted(false)
                    .isElectionActive(false)
                    .electionStatus("Not Activated")
                        .build();
            }

            ElectionVoteReadiness.ActiveWindow window = ElectionVoteReadiness.activeWindow(election);
            boolean isElectionActive = window.active();
            String electionStatus = window.statusLabel();

            VoterEligibilityResolver.Snapshot voter = voterEligibilityResolver.resolve(userEmail, election);
            boolean hasVoted = voter.hasVoted();
            boolean isEligible = voter.isEligibleToVote(election);

            // 6. Build comprehensive response
            String message;
            String reason;
            boolean overallEligible = false;

            if (hasVoted) {
                message = "You have already voted in this election";
                reason = "Already voted";
            } else if (!isEligible) {
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

    private Optional<CreateEncryptedBallotResponse> rejectIfElectionNotReady(Election election) {
        Optional<String> activationBlock = ElectionVoteReadiness.activationBlockReason(election);
        if (activationBlock.isPresent()) {
            String reason = activationBlock.get();
            if ("Election not scheduled".equals(reason)) {
                return Optional.of(CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Election schedule is not set yet")
                        .errorReason(reason)
                        .build());
            }
            return Optional.of(CreateEncryptedBallotResponse.builder()
                    .success(false)
                    .message("Election is not activated yet. Key ceremony is incomplete.")
                    .errorReason(reason)
                    .build());
        }
        if (!ElectionVoteReadiness.isWithinVotingWindow(election)) {
            if (Instant.now().isBefore(election.getStartingTime())) {
                return Optional.of(CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Election has not started yet")
                        .errorReason("Election not active")
                        .build());
            }
            return Optional.of(CreateEncryptedBallotResponse.builder()
                    .success(false)
                    .message("Election has ended")
                    .errorReason("Election ended")
                    .build());
        }
        return Optional.empty();
    }

    private Optional<CastBallotResponse> rejectCastIfElectionNotReady(Election election) {
        Optional<String> activationBlock = ElectionVoteReadiness.activationBlockReason(election);
        if (activationBlock.isPresent()) {
            String reason = activationBlock.get();
            if ("Election not scheduled".equals(reason)) {
                return Optional.of(CastBallotResponse.builder()
                        .success(false)
                        .message("Election schedule is not set yet")
                        .errorReason(reason)
                        .build());
            }
            return Optional.of(CastBallotResponse.builder()
                    .success(false)
                    .message("Election is not activated yet. Key ceremony is incomplete.")
                    .errorReason(reason)
                    .build());
        }
        if (!ElectionVoteReadiness.isWithinVotingWindow(election)) {
            if (Instant.now().isBefore(election.getStartingTime())) {
                return Optional.of(CastBallotResponse.builder()
                        .success(false)
                        .message("Election has not started yet")
                        .errorReason("Election not active")
                        .build());
            }
            return Optional.of(CastBallotResponse.builder()
                    .success(false)
                    .message("Election has ended")
                    .errorReason("Election ended")
                    .build());
        }
        return Optional.empty();
    }

    private Optional<CreateEncryptedBallotResponse> rejectEncryptIfVoterCannotVote(
            String userEmail, Election election) {
        VoterEligibilityResolver.Snapshot voter = voterEligibilityResolver.resolve(userEmail, election);
        if (!voter.isEligibleToVote(election)) {
            if ("listed".equals(election.getEligibility())) {
                return Optional.of(CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("You are not eligible to vote in this election. You are not in the allowed voters list.")
                        .errorReason("Not in voter list for listed election")
                        .build());
            }
            return Optional.of(CreateEncryptedBallotResponse.builder()
                    .success(false)
                    .message("You are not eligible to vote in this election due to unknown eligibility criteria.")
                    .errorReason("Unknown eligibility criteria")
                    .build());
        }
        if (voter.hasVoted()) {
            return Optional.of(CreateEncryptedBallotResponse.builder()
                    .success(false)
                    .message("You have already voted in this election")
                    .errorReason("Already voted")
                    .build());
        }
        return Optional.empty();
    }

    private Optional<CastBallotResponse> rejectCastIfVoterCannotVote(String userEmail, Election election) {
        VoterEligibilityResolver.Snapshot voter = voterEligibilityResolver.resolve(userEmail, election);
        if (!voter.isEligibleToVote(election)) {
            return Optional.of(CastBallotResponse.builder()
                    .success(false)
                    .message("You are not eligible to vote in this election")
                    .errorReason("Not eligible")
                    .build());
        }
        if (voter.hasVoted()) {
            return Optional.of(CastBallotResponse.builder()
                    .success(false)
                    .message("You have already voted in this election")
                    .errorReason("Already voted")
                    .build());
        }
        return Optional.empty();
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

    private ElectionGuardBallotResponse callElectionGuardService(
            List<String> partyNames, List<String> candidateNames, List<String> selectedCandidates,
            String ballotId, String jointPublicKey, String commitmentHash,
            int quorum, int numberOfGuardians, int maxChoices) {

        try {
            String url = "/create_encrypted_ballot";

            ElectionGuardBallotRequest request = ElectionGuardBallotRequest.builder()
                    .party_names(partyNames)
                    .candidate_names(candidateNames)
                    .candidate_names_to_vote(selectedCandidates)
                    .ballot_id(ballotId)
                    .joint_public_key(jointPublicKey)
                    .commitment_hash(commitmentHash)
                    .number_of_guardians(numberOfGuardians)
                    .quorum(quorum)
                    .max_choices(maxChoices)
                    .build();

            System.out.println("Calling ElectionGuard ballot service at: " + url);
            System.out.println("Sending request to ElectionGuard service: " + request);

            String response = electionGuardService.postRequest(url, request);

            System.out.println("Received response from ElectionGuard service: ");

            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            return objectMapper.readValue(response, ElectionGuardBallotResponse.class);
        } catch (ElectionGuardCapacityException e) {
            throw e;
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }

    private static final String UNSELECTED_CANDIDATE_PLACEHOLDER = "__AMARVOTE_UNSELECTED__";

    /**
     * Decode a fixed-width stuffed candidate slot from the client payload.
     * Frontend pads names with U+00A0 (NBSP); Java trim() does not strip those.
     */
    private String decodeStuffedCandidateSlot(String candidate) {
        if (candidate == null || candidate.isEmpty()) {
            return "";
        }

        int end = candidate.length();
        while (end > 0 && candidate.charAt(end - 1) == '\u00A0') {
            end--;
        }

        String decoded = candidate.substring(0, end).trim();
        if (decoded.isEmpty() || UNSELECTED_CANDIDATE_PLACEHOLDER.equals(decoded)) {
            return "";
        }
        return decoded;
    }

    private List<String> normalizeSelectedCandidates(List<String> selectedCandidates, int maxChoices) {
        if (selectedCandidates == null) {
            return List.of();
        }

        List<String> normalized = selectedCandidates.stream()
                .map(this::decodeStuffedCandidateSlot)
                .filter(candidate -> !candidate.isBlank())
                .collect(Collectors.toList());

        if (selectedCandidates.size() != maxChoices) {
            System.out.println("⚠️ [BALLOT STUFFING] Expected " + maxChoices
                    + " selection slots but received " + selectedCandidates.size());
        }

        return normalized;
    }

    private String normalizeCandidateTitle(String title) {
        if (title == null) {
            return "";
        }
        return title.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }

    private boolean candidateTitlesMatch(String dbTitle, String selectedTitle) {
        String normalizedDb = normalizeCandidateTitle(dbTitle);
        String normalizedSelected = normalizeCandidateTitle(selectedTitle);
        if (normalizedDb.equals(normalizedSelected)) {
            return true;
        }
        // Stuffed slots may truncate very long names at 128 chars
        if (normalizedSelected.length() >= CANDIDATE_NAME_SLOT_WIDTH - 1) {
            return normalizedDb.startsWith(normalizedSelected)
                    || normalizedSelected.startsWith(normalizedDb);
        }
        return false;
    }

    private static final int CANDIDATE_NAME_SLOT_WIDTH = 128;

    /**
     * Resolve client selections to canonical DB option titles.
     * Prefers choice IDs when provided; falls back to normalized title matching.
     */
    private List<String> resolveSelectedCandidateTitles(
            List<Long> selectedChoiceIds,
            List<String> rawSelectedNames,
            List<ElectionChoice> choices,
            int maxChoices) {

        if (selectedChoiceIds != null && !selectedChoiceIds.isEmpty()) {
            Map<Long, ElectionChoice> choiceById = choices.stream()
                    .collect(Collectors.toMap(ElectionChoice::getChoiceId, c -> c, (a, b) -> a));

            List<String> resolved = new ArrayList<>();
            for (Long choiceId : selectedChoiceIds) {
                ElectionChoice choice = choiceById.get(choiceId);
                if (choice == null) {
                    System.out.println("❌ [BALLOT] Invalid choice ID: " + choiceId);
                    return null;
                }
                resolved.add(choice.getOptionTitle());
            }
            return resolved;
        }

        List<String> decodedNames = normalizeSelectedCandidates(rawSelectedNames, maxChoices);
        List<String> resolved = new ArrayList<>();
        for (String decodedName : decodedNames) {
            Optional<ElectionChoice> match = choices.stream()
                    .filter(choice -> candidateTitlesMatch(choice.getOptionTitle(), decodedName))
                    .findFirst();
            if (match.isEmpty()) {
                System.out.println("❌ [BALLOT] No election choice matches decoded selection: ["
                        + decodedName + "]");
                return null;
            }
            resolved.add(match.get().getOptionTitle());
        }
        return resolved;
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
     * Create encrypted ballot without casting - for challenge/cast flow.
     * Not @Transactional: the ElectionGuard call can take minutes under load;
     * holding a DB connection for that duration exhausts HikariCP and blocks eligibility checks.
     */
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

            Optional<CreateEncryptedBallotResponse> notReady = rejectIfElectionNotReady(election);
            if (notReady.isPresent()) {
                return notReady.get();
            }

            Optional<CreateEncryptedBallotResponse> voterReject = rejectEncryptIfVoterCannotVote(userEmail, election);
            if (voterReject.isPresent()) {
                return voterReject.get();
            }

            // 6. Validate candidate choices (multi-select)
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            Integer electionMaxChoices = election.getMaxChoices();
            int maxChoices = (electionMaxChoices != null) ? electionMaxChoices : 1;
            List<String> selectedCandidates = resolveSelectedCandidateTitles(
                    request.getSelectedChoiceIds(),
                    request.getSelectedCandidates(),
                    choices,
                    maxChoices);
            if (selectedCandidates == null || selectedCandidates.isEmpty()) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message(selectedCandidates == null
                                ? "One or more invalid candidate selections"
                                : "No candidates selected")
                        .errorReason(selectedCandidates == null ? "Invalid candidate" : "No candidates selected")
                        .build();
            }
            // Check for duplicates
            Set<String> selectedSet = new HashSet<>(selectedCandidates);
            if (selectedSet.size() != selectedCandidates.size()) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("Duplicate candidates selected")
                        .errorReason("Duplicate selection")
                        .build();
            }
            // Check maxChoices
            if (selectedCandidates.size() > maxChoices) {
                return CreateEncryptedBallotResponse.builder()
                        .success(false)
                        .message("You can select at most " + maxChoices + " candidate(s)")
                        .errorReason("Too many candidates selected")
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
                    partyNames, candidateNames, selectedCandidates,
                    ballotHashId, election.getJointPublicKey(), election.getBaseHash(),
                    election.getElectionQuorum(),
                    guardianRepository.countByElectionId(election.getElectionId()),
                    maxChoices);

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

        } catch (ElectionGuardCapacityException e) {
            return CreateEncryptedBallotResponse.builder()
                    .success(false)
                    .message("Voting system is busy encrypting ballots. Please wait a moment and try again.")
                    .errorReason("Service temporarily at capacity")
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
     * Perform Benaloh challenge verification (read-only + external crypto; no long DB transaction).
     */
    public BenalohChallengeResponse performBenalohChallenge(BenalohChallengeRequest request, String userEmail) {
        try {
            System.out.println("🔍 [BENALOH] Starting Benaloh challenge for user: " + userEmail);
            System.out.println("🔍 [BENALOH] Request data: electionId=" + request.getElectionId() + 
                              ", candidates=" + request.getCandidate_names_to_verify());

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

            // 2. Validate candidate choices
            System.out.println("🔍 [BENALOH] Fetching election choices...");
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            System.out.println("🔍 [BENALOH] Found " + choices.size() + " choices");
            for (ElectionChoice choice : choices) {
                System.out.println("🔍 [BENALOH] Choice: " + choice.getOptionTitle());
            }
            
            List<String> candidatesToVerify = request.getCandidate_names_to_verify();
            if (candidatesToVerify == null || candidatesToVerify.isEmpty()) {
                return BenalohChallengeResponse.builder()
                        .success(false)
                        .message("No candidates specified for verification")
                        .errorReason("No candidates")
                        .build();
            }
            Set<String> validChoiceTitles = choices.stream()
                    .map(ElectionChoice::getOptionTitle)
                    .collect(Collectors.toSet());
            boolean allValid = candidatesToVerify.stream().allMatch(validChoiceTitles::contains);
            System.out.println("🔍 [BENALOH] All candidates valid: " + allValid);
            if (!allValid) {
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
                    partyNames, candidateNames, candidatesToVerify,
                    ballotId, election.getJointPublicKey(), election.getBaseHash(),
                    election.getElectionQuorum(),
                    guardianRepository.countByElectionId(election.getElectionId()),
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
            List<String> partyNames, List<String> candidateNames, List<String> candidateNamesToVerify,
            String ballotId, String jointPublicKey, String commitmentHash,
            int quorum, int numberOfGuardians, String encryptedBallotWithNonce) {

        try {
            System.out.println("🌐 [BENALOH API] Starting microservice call...");
            String url = "/benaloh_challenge";
            System.out.println("🌐 [BENALOH API] URL: " + url);

            ElectionGuardBenalohRequest request = ElectionGuardBenalohRequest.builder()
                    .party_names(partyNames)
                    .candidate_names(candidateNames)
                    .candidate_names_to_verify(candidateNamesToVerify)
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
     * Cast a pre-encrypted ballot.
     * Not {@code @Transactional}: eligibility checks stay outside the DB transaction.
     */
    public CastBallotResponse castEncryptedBallot(CastEncryptedBallotRequest request, String userEmail, String siteBaseUrl) {
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

            Optional<CastBallotResponse> notReady = rejectCastIfElectionNotReady(election);
            if (notReady.isPresent()) {
                return notReady.get();
            }

            Optional<CastBallotResponse> voterReject = rejectCastIfVoterCannotVote(userEmail, election);
            if (voterReject.isPresent()) {
                return voterReject.get();
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
            BallotCastPersistenceService.CastPersistOutcome persistOutcome =
                    ballotCastPersistenceService.persistCast(ballot, userEmail, election);
            if (persistOutcome == BallotCastPersistenceService.CastPersistOutcome.ALREADY_VOTED) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You have already voted in this election")
                        .errorReason("Already voted")
                        .build();
            }
            if (persistOutcome == BallotCastPersistenceService.CastPersistOutcome.NOT_ELIGIBLE) {
                return CastBallotResponse.builder()
                        .success(false)
                        .message("You are not eligible to vote in this election")
                        .errorReason("Not eligible")
                        .build();
            }

            // Blockchain disabled (blockchain.enabled=false) — ballot is persisted in Postgres only.
            // blockchainService.recordBallotAsync(
            //         election.getElectionId().toString(),
            //         request.getBallot_tracking_code(),
            //         request.getBallot_hash());

            queueVoteReceiptEmail(
                    userEmail,
                    election,
                    request.getBallot_hash(),
                    request.getBallot_tracking_code(),
                    null,
                    null,
                    siteBaseUrl);

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

    private String findPartyForCandidate(List<ElectionChoice> choices, String candidateName) {
        return choices.stream()
                .filter(c -> c.getOptionTitle().equals(candidateName))
                .map(ElectionChoice::getPartyName)
                .findFirst()
                .orElse("N/A");
    }

    private void queueVoteReceiptEmail(String userEmail, Election election, String hashCode, String trackingCode,
            String candidateName, String partyName, String siteBaseUrl) {
        if (!Boolean.TRUE.equals(election.getSendBallotReceipt())) {
            return;
        }

        try {
            VoteReceiptService.PreparedReceiptEmail prepared = voteReceiptService.prepareReceiptEmail(
                    userEmail,
                    election,
                    hashCode,
                    trackingCode,
                    candidateName,
                    partyName);

            VoteReceiptTask task = VoteReceiptTask.builder()
                .electionId(election.getElectionId())
                .electionTitle(election.getElectionTitle())
                .voterEmail(userEmail)
                .trackingCode(trackingCode)
                .hashCode(hashCode)
                .receiptContent(prepared.plaintextContent())
                .receiptDownloadToken(prepared.downloadToken())
                .siteBaseUrl(siteBaseUrl)
                .build();

            taskPublisherService.publishVoteReceiptTask(task);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to queue vote receipt email task: " + e.getMessage());
        }
    }
}

