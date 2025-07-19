package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.CombinePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesRequest;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesResponse;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionResponse;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
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
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
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

            // 7. Get the encrypted tally as string (microservice expects string format)
            String ciphertextTallyString = election.getEncryptedTally();
            if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election tally has not been created yet")
                    .build();
            }

            // 8. Call ElectionGuard microservice
            ElectionGuardPartialDecryptionRequest guardRequest = ElectionGuardPartialDecryptionRequest.builder()
                .guardian_id(String.valueOf(guardian.getSequenceOrder()))
                .guardian_data(guardian.getKeyBackup())
                .private_key(request.key())
                .public_key(guardian.getGuardianPublicKey())
                .polynomial(guardian.getGuardianPolynomial())
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .ciphertext_tally(ciphertextTallyString)
                .submitted_ballots(ballotCipherTexts)
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .number_of_guardians(numberOfGuardians)
                .quorum(election.getElectionQuorum())
                .build();
            // System.out.println('the private key: ');
            System.out.println("Successfully build the body of the request ");

            ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);

            System.out.println("Received response from ElectionGuard service:-- the response is: " + guardResponse);

            // 9. Check if tally_share is null (invalid key)
            if (guardResponse.tally_share() == null) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("The key you provided was not right, please provide the right key")
                    .build();
            }

            // 10. Update guardian record with response data
            // ✅ Fixed: Store ballot_shares directly as string (no double serialization)
            System.out.println("Now we are moving to save ballot shares");
            String ballotSharesJson = guardResponse.ballot_shares(); // Store directly

            guardian.setPartialDecryptedTally(ballotSharesJson);
            guardian.setGuardianDecryptionKey(guardResponse.guardian_public_key());
            guardian.setTallyShare(guardResponse.tally_share());
            
            // Mark guardian as having completed decryption
            guardian.setDecryptedOrNot(true);
            
            guardianRepository.save(guardian);
            System.out.println("saving done ---");

            // 11. Create compensated decryption shares for ALL other guardians
            createCompensatedDecryptionShares(election, guardian, request.key());

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
            System.out.println("Sending request to ElectionGuard service: ");
            
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

            // 6. ✅ Check quorum before combining decryption shares
            List<Guardian> availableGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() != null && g.getDecryptedOrNot() && 
                           g.getTallyShare() != null && !g.getTallyShare().trim().isEmpty())
                .collect(Collectors.toList());
            
            int quorum = election.getElectionQuorum();
            if (availableGuardians.size() < quorum) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message(String.format("Quorum not met for decryption. Need at least %d guardians to decrypt election results, but only %d guardians have submitted their keys. Please ensure more guardians submit their partial decryption keys.", 
                            quorum, availableGuardians.size()))
                    .build();
            }

            System.out.println(String.format("✅ Quorum met: %d/%d guardians have submitted keys (quorum: %d)", 
                    availableGuardians.size(), guardians.size(), quorum));

            // Log available and missing guardian details
            List<Integer> availableSequences = availableGuardians.stream()
                .map(Guardian::getSequenceOrder)
                .collect(Collectors.toList());
            System.out.println("Available guardian sequences: " + availableSequences);

            // 7. ✅ NEW: Prepare data for combine_decryption_shares endpoint
            // Get guardian data for all guardians (needed for missing guardian reconstruction)
            List<String> guardianDataList = guardians.stream()
                .map(Guardian::getKeyBackup)
                .collect(Collectors.toList());

            // Available guardian data (those who completed decryption)
            List<String> availableGuardianIds = availableGuardians.stream()
                .map(g -> String.valueOf(g.getSequenceOrder()))
                .collect(Collectors.toList());
            
            List<String> availableGuardianPublicKeys = availableGuardians.stream()
                .map(Guardian::getGuardianDecryptionKey)
                .collect(Collectors.toList());
            
            List<String> availableTallyShares = availableGuardians.stream()
                .map(Guardian::getTallyShare)
                .collect(Collectors.toList());
            
            List<String> availableBallotShares = availableGuardians.stream()
                .map(guardian -> {
                    if (guardian.getPartialDecryptedTally() != null && !guardian.getPartialDecryptedTally().trim().isEmpty()) {
                        return guardian.getPartialDecryptedTally();
                    }
                    return "{}";
                })
                .collect(Collectors.toList());

            // Missing guardian data (those who haven't completed decryption)
            List<Guardian> missingGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() == null || !g.getDecryptedOrNot() ||
                           g.getTallyShare() == null || g.getTallyShare().trim().isEmpty())
                .collect(Collectors.toList());
            
            // Get compensated decryption shares from database
            List<CompensatedDecryption> compensatedDecryptions = compensatedDecryptionRepository.findByElectionId(request.election_id());
            
            // ✅ FIXED: Maintain sequential order for missing_guardian_ids and compensating_guardian_ids
            // to match the order of compensated_tally_shares and compensated_ballot_shares
            List<String> missingGuardianIds = new ArrayList<>();
            List<String> compensatingGuardianIds = new ArrayList<>();
            List<String> compensatedTallyShares = new ArrayList<>();
            List<String> compensatedBallotShares = new ArrayList<>();
            
            // Create a set for faster lookup of missing guardian sequences
            Set<Integer> missingGuardianSequences = missingGuardians.stream()
                .map(Guardian::getSequenceOrder)
                .collect(Collectors.toSet());
            
            System.out.println("Missing guardian sequences: " + missingGuardianSequences);
            
            // ✅ FIXED: Collect compensated shares ONLY for guardians who are actually MISSING
            // Note: Even though we now create compensated shares for ALL guardians, we only use them 
            // during combination for guardians who are actually missing (haven't submitted their decryption)
            // and maintain sequential order: missing_guardian_ids[i] corresponds to compensating_guardian_ids[i]
            // which corresponds to compensated_tally_shares[i] and compensated_ballot_shares[i]
            for (CompensatedDecryption cd : compensatedDecryptions) {
                // Only include compensated shares for guardians who are actually missing
                if (missingGuardianSequences.contains(cd.getMissingGuardianSequence())) {
                    // Add elements in the same sequential order to maintain correspondence
                    missingGuardianIds.add(String.valueOf(cd.getMissingGuardianSequence()));
                    compensatingGuardianIds.add(String.valueOf(cd.getCompensatingGuardianSequence()));
                    compensatedTallyShares.add(cd.getCompensatedTallyShare());
                    compensatedBallotShares.add(cd.getCompensatedBallotShare());
                    
                    System.out.println("✅ Added compensated share: missing=" + cd.getMissingGuardianSequence() + 
                                     ", compensating=" + cd.getCompensatingGuardianSequence() + 
                                     " (index=" + (compensatedTallyShares.size() - 1) + ")");
                } else {
                    System.out.println("⏭️ Skipped compensated share from guardian " + cd.getCompensatingGuardianSequence() + 
                                     " for available guardian " + cd.getMissingGuardianSequence() + " (not needed)");
                }
            }

            // 8. ✅ NEW: Call the new combine_decryption_shares endpoint
            ElectionGuardCombineDecryptionSharesRequest guardRequest = ElectionGuardCombineDecryptionSharesRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .ciphertext_tally(election.getEncryptedTally())
                .submitted_ballots(ballotCipherTexts)
                .guardian_data(guardianDataList)
                .available_guardian_ids(availableGuardianIds)
                .available_guardian_public_keys(availableGuardianPublicKeys)
                .available_tally_shares(availableTallyShares)
                .available_ballot_shares(availableBallotShares)
                .missing_guardian_ids(missingGuardianIds)
                .compensating_guardian_ids(compensatingGuardianIds)
                .compensated_tally_shares(compensatedTallyShares)
                .compensated_ballot_shares(compensatedBallotShares)
                .quorum(quorum)
                .number_of_guardians(guardians.size())
                .build();

            ElectionGuardCombineDecryptionSharesResponse guardResponse = callElectionGuardCombineDecryptionSharesService(guardRequest);

            // 9. ✅ Process the response string to extract results
            if ("success".equals(guardResponse.status())) {
                Object resultsObject = parseResultsString(guardResponse.results());
                
                // Update the total_votes in election_choices table
                updateElectionChoicesWithResults(request.election_id(), resultsObject, electionChoices);
                
                // Update election status to 'decrypted'
                election.setStatus("decrypted");
                electionRepository.save(election);
                
                System.out.println("✅ Successfully combined partial decryptions for election: " + request.election_id());
                System.out.println("✅ Updated election status to 'decrypted'");
                System.out.println("✅ Election results are now available for viewing");
                
                return CombinePartialDecryptionResponse.builder()
                    .success(true)
                    .message("Election results successfully decrypted and ready for viewing")
                    .results(resultsObject)
                    .build();
            } else {
                System.err.println("❌ ElectionGuard combine decryption failed with status: " + guardResponse.status());
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to combine partial decryption: " + guardResponse.status())
                    .build();
            }

        } catch (Exception e) {
            System.err.println("Error combining partial decryption: " + e.getMessage());
            e.printStackTrace();
            return CombinePartialDecryptionResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
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

    /**
     * Creates compensated decryption shares for ALL other guardians using the available guardian
     */
    private void createCompensatedDecryptionShares(Election election, Guardian availableGuardian, String availableGuardianPrivateKey) {
        try {
            System.out.println("Starting compensated decryption for election: " + election.getElectionId());
            
            // Get all guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(election.getElectionId());
            
            // Get ALL other guardians (excluding the current guardian who is creating compensated shares)
            List<Guardian> otherGuardians = allGuardians.stream()
                .filter(g -> !g.getSequenceOrder().equals(availableGuardian.getSequenceOrder()))
                .collect(Collectors.toList());
            
            System.out.println("Total guardians: " + allGuardians.size() + 
                             ", Other guardians (excluding current): " + otherGuardians.size());
            
            // Create compensated shares for ALL other guardians
            if (otherGuardians.isEmpty()) {
                System.out.println("No other guardians found, skipping compensated decryption");
                return;
            }
            
            // For each OTHER guardian, create compensated share using the current guardian
            // (who just submitted their key and whose private key we have)
            for (Guardian otherGuardian : otherGuardians) {
                // Get all existing compensated shares for this other guardian
                List<CompensatedDecryption> existingShares = compensatedDecryptionRepository
                    .findByElectionIdAndMissingGuardianSequence(
                        election.getElectionId(), 
                        otherGuardian.getSequenceOrder()
                    );
                
                boolean shouldCreateShare = false;
                
                if (existingShares.isEmpty()) {
                    // No compensated share exists for this other guardian - create one
                    shouldCreateShare = true;
                    System.out.println("No compensated share exists for guardian " + otherGuardian.getSequenceOrder() + 
                                     " - creating one from guardian " + availableGuardian.getSequenceOrder());
                } else {
                    // Check if current guardian has lower sequence order than existing compensating guardians
                    int lowestExistingCompensatingSequence = existingShares.stream()
                        .mapToInt(CompensatedDecryption::getCompensatingGuardianSequence)
                        .min()
                        .orElse(Integer.MAX_VALUE);
                    
                    if (availableGuardian.getSequenceOrder() < lowestExistingCompensatingSequence) {
                        // Current guardian has lower sequence order - replace with its compensated share
                        shouldCreateShare = true;
                        System.out.println("Guardian " + availableGuardian.getSequenceOrder() + 
                                         " has lower sequence order than existing compensating guardians (" + 
                                         lowestExistingCompensatingSequence + ") - creating compensated share");
                    } else {
                        System.out.println("Compensated share already exists from guardian with lower/equal sequence order for guardian " + 
                                         otherGuardian.getSequenceOrder() + " - skipping");
                    }
                }
                
                if (shouldCreateShare) {
                    // Only create compensated share if it doesn't already exist from this specific guardian
                    List<CompensatedDecryption> specificExists = compensatedDecryptionRepository
                        .findByElectionIdAndCompensatingGuardianSequenceAndMissingGuardianSequence(
                            election.getElectionId(), 
                            availableGuardian.getSequenceOrder(), 
                            otherGuardian.getSequenceOrder()
                        );
                    
                    if (specificExists.isEmpty()) {
                        createCompensatedShare(election, availableGuardian, otherGuardian, availableGuardianPrivateKey);
                        System.out.println("Created compensated share: Guardian " + availableGuardian.getSequenceOrder() + 
                                         " compensating for Guardian " + otherGuardian.getSequenceOrder());
                    } else {
                        System.out.println("Compensated share already exists: Guardian " + availableGuardian.getSequenceOrder() + 
                                         " compensating for Guardian " + otherGuardian.getSequenceOrder());
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error creating compensated decryption shares: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Creates a compensated decryption share for a specific other guardian using a compensating guardian
     */
    private void createCompensatedShare(Election election, Guardian compensatingGuardian, Guardian otherGuardian, String compensatingGuardianPrivateKey) {
        try {
            System.out.println("Creating compensated share: compensating=" + compensatingGuardian.getSequenceOrder() + 
                             ", other=" + otherGuardian.getSequenceOrder());
            
            // Check if compensated share already exists
            boolean existsAlready = compensatedDecryptionRepository
                .existsByElectionIdAndCompensatingGuardianSequenceAndMissingGuardianSequence(
                    election.getElectionId(), 
                    compensatingGuardian.getSequenceOrder(), 
                    otherGuardian.getSequenceOrder());
            
            if (existsAlready) {
                System.out.println("Compensated share already exists, skipping");
                return;
            }
            
            // Build request to microservice
            // Get election choices for party and candidate names
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionId(election.getElectionId());
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .filter(partyName -> partyName != null && !partyName.trim().isEmpty())
                .distinct()
                .collect(Collectors.toList());
            
            // Get submitted ballots for this election
            List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionId(election.getElectionId());
            List<String> ballotCipherTexts = submittedBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .collect(Collectors.toList());
            
            ElectionGuardCompensatedDecryptionRequest request = ElectionGuardCompensatedDecryptionRequest.builder()
                .available_guardian_id(String.valueOf(compensatingGuardian.getSequenceOrder()))
                .missing_guardian_id(String.valueOf(otherGuardian.getSequenceOrder()))
                .available_guardian_data(compensatingGuardian.getKeyBackup()) // Guardian data JSON
                .missing_guardian_data(otherGuardian.getKeyBackup())       // Guardian data JSON
                .available_private_key(compensatingGuardianPrivateKey)       // Private key from request
                .available_public_key(compensatingGuardian.getGuardianPublicKey())   // Public key JSON
                .available_polynomial(compensatingGuardian.getGuardianPolynomial())  // Polynomial JSON
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .ciphertext_tally(election.getEncryptedTally()) // ✅ Fixed: Use correct field
                .submitted_ballots(ballotCipherTexts)           // ✅ Fixed: Use submitted ballots
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .number_of_guardians(electionChoices.size() > 0 ? guardianRepository.findByElectionId(election.getElectionId()).size() : 1)
                .quorum(election.getElectionQuorum())
                .build();
            
            // Call microservice
            ElectionGuardCompensatedDecryptionResponse response = callElectionGuardCompensatedDecryptionService(request);
            
            if (response == null || response.compensated_tally_share() == null) {
                System.err.println("Failed to get compensated decryption response from microservice");
                return;
            }
            
            // Save compensated decryption to database
            CompensatedDecryption compensatedDecryption = new CompensatedDecryption();
            compensatedDecryption.setElectionId(election.getElectionId());
            compensatedDecryption.setCompensatingGuardianSequence(compensatingGuardian.getSequenceOrder());
            compensatedDecryption.setMissingGuardianSequence(otherGuardian.getSequenceOrder());
            compensatedDecryption.setCompensatedTallyShare(response.compensated_tally_share());
            compensatedDecryption.setCompensatedBallotShare(response.compensated_ballot_shares());
            
            compensatedDecryptionRepository.save(compensatedDecryption);
            
            System.out.println("Successfully saved compensated decryption share");
            
        } catch (Exception e) {
            System.err.println("Error creating compensated share: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Calls the ElectionGuard microservice to create compensated decryption
     */
    private ElectionGuardCompensatedDecryptionResponse callElectionGuardCompensatedDecryptionService(
            ElectionGuardCompensatedDecryptionRequest request) {
        try {
            String url = "/create_compensated_decryption";
            
            System.out.println("Calling ElectionGuard compensated decryption service at: " + url);
            
            String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }

            return objectMapper.readValue(response, ElectionGuardCompensatedDecryptionResponse.class);
                
        } catch (Exception e) {
            System.err.println("Error calling ElectionGuard compensated decryption service: " + e.getMessage());
            return null;
        }
    }

    /**
     * Calls the ElectionGuard microservice to combine decryption shares with quorum support
     */
    private ElectionGuardCombineDecryptionSharesResponse callElectionGuardCombineDecryptionSharesService(
            ElectionGuardCombineDecryptionSharesRequest request) {
        try {
            String url = "/combine_decryption_shares";
            
            System.out.println("Calling ElectionGuard combine decryption shares service at: " + url);
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

            return objectMapper.readValue(response, ElectionGuardCombineDecryptionSharesResponse.class);
        } catch (Exception e) {
            System.err.println("Failed to call ElectionGuard combine decryption shares service: " + e.getMessage());
            throw new RuntimeException("Failed to call ElectionGuard combine decryption shares service", e);
        }
    }

    /**
     * Parses the results string from the microservice response
     */
    private Object parseResultsString(String resultsString) {
        try {
            return objectMapper.readValue(resultsString, Object.class);
        } catch (Exception e) {
            System.err.println("Error parsing results string: " + e.getMessage());
            return resultsString; // Return as string if parsing fails
        }
    }
}
