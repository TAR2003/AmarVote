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
import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesRequest;
import com.amarvote.amarvote.dto.ElectionGuardCombineDecryptionSharesResponse;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardCompensatedDecryptionResponse;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionRequest;
import com.amarvote.amarvote.dto.ElectionGuardPartialDecryptionResponse;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
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
    private final BallotRepository ballotRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final DecryptionRepository decryptionRepository;
    private final ObjectMapper objectMapper;
    private final ElectionGuardCryptoService cryptoService;
    private final TallyService tallyService;
    
    @Autowired
    private WebClient webClient;

    @Transactional
    public CreatePartialDecryptionResponse createPartialDecryption(CreatePartialDecryptionRequest request, String userEmail) {
        try {
            System.out.println("=== Starting Partial Decryption Process ===");
            System.out.println("Election ID: " + request.election_id() + ", User: " + userEmail);
            
            // 1. Find user by email
            Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
            if (!userOpt.isPresent()) {
                System.err.println("User not found: " + userEmail);
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
            List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.election_id());
            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            List<String> candidateNames = choices.stream()
                .map(ElectionChoice::getOptionTitle)
                .toList();
            List<String> partyNames = choices.stream()
                .map(ElectionChoice::getPartyName)
                .toList();

            // 5. Get number of guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(request.election_id());
            int numberOfGuardians = allGuardians.size();

            // Check if encrypted tally exists (check election_center table for chunks)
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
            System.out.println("=== TALLY CHECK PHASE ===");
            System.out.println("Checking if encrypted tally exists for election " + request.election_id());
            System.out.println("Found " + electionCenters.size() + " chunk(s) in election_center table");
            
            if (electionCenters.isEmpty()) {
                System.out.println("❌ NO ENCRYPTED TALLY FOUND - INITIATING AUTO-CREATION PROCESS");
                System.out.println("No encrypted tally found for election " + request.election_id() + ". Attempting to create tally automatically.");
                
                // Check if there are any ballots to create a tally from
                System.out.println("=== CHECKING FOR SUBMITTED BALLOTS ===");
                // TODO: Update to use chunking - ballots are now in ElectionCenters
                // List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionId(request.election_id());
                List<SubmittedBallot> submittedBallots = new ArrayList<>();
                System.out.println("Found " + submittedBallots.size() + " submitted ballots for election " + request.election_id());
                
                // Also check the original Ballot table (ballots might not be moved to SubmittedBallot yet)
                List<Ballot> originalBallots = ballotRepository.findByElectionId(request.election_id());
                System.out.println("Found " + originalBallots.size() + " original ballots for election " + request.election_id());
                
                int totalBallots = submittedBallots.size() + originalBallots.size();
                System.out.println("Total ballots found: " + totalBallots);
                
                if (totalBallots == 0) {
                    System.err.println("❌ NO BALLOTS FOUND - CANNOT CREATE TALLY");
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Cannot proceed with partial decryption. No votes have been submitted for this election yet.")
                        .build();
                }
                
                System.out.println("✅ BALLOTS FOUND - PROCEEDING WITH AUTO-TALLY CREATION");
                
                // Check if admin email exists
                System.out.println("=== CHECKING ADMIN EMAIL ===");
                System.out.println("Election admin email: " + (election.getAdminEmail() == null ? "NULL" : election.getAdminEmail()));
                if (election.getAdminEmail() == null || election.getAdminEmail().trim().isEmpty()) {
                    System.err.println("❌ ADMIN EMAIL IS NULL/EMPTY - CANNOT CREATE TALLY");
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Cannot auto-create tally: Election admin email is not available.")
                        .build();
                }
                
                System.out.println("✅ Admin email found: " + election.getAdminEmail());
                System.out.println("Auto-creating tally for election " + request.election_id() + " using admin email: " + election.getAdminEmail());
                
                // Auto-create the tally
                System.out.println("=== PREPARING TALLY REQUEST ===");
                CreateTallyRequest tallyRequest = CreateTallyRequest.builder()
                    .election_id(request.election_id())
                    .build();
                
                System.out.println("✅ Tally request prepared for election ID: " + tallyRequest.getElection_id());
                System.out.println("🚀 CALLING TALLY SERVICE - createTally()");
                
                // Get the admin email from election to create tally
                CreateTallyResponse tallyResponse;
                try {
                    // Use bypassEndTimeCheck=true since partial decryption should only happen after election ends
                    // and we want to auto-create the tally in this case
                    tallyResponse = tallyService.createTally(tallyRequest, election.getAdminEmail(), true);
                    System.out.println("🔄 TallyService call completed");
                } catch (Exception e) {
                    System.err.println("❌ EXCEPTION in TallyService.createTally(): " + e.getMessage());
                    e.printStackTrace();
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Failed to auto-create tally due to exception: " + e.getMessage())
                        .build();
                }
                
                System.out.println("=== TALLY SERVICE RESPONSE ===");
                System.out.println("Tally service response: success=" + tallyResponse.isSuccess() + ", message=" + tallyResponse.getMessage());
                
                if (!tallyResponse.isSuccess()) {
                    System.err.println("❌ TALLY CREATION FAILED: " + tallyResponse.getMessage());
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Failed to auto-create tally before partial decryption: " + tallyResponse.getMessage())
                        .build();
                }
                
                System.out.println("✅ TALLY CREATION SUCCESSFUL");
                
                // Refresh election data after tally creation
                System.out.println("=== REFRESHING ELECTION DATA ===");
                electionCenters = electionCenterRepository.findByElectionId(request.election_id());
                
                System.out.println("=== VERIFYING TALLY CREATION ===");
                System.out.println("After refresh - Found " + electionCenters.size() + " chunk(s)");
                
                if (electionCenters.isEmpty()) {
                    System.err.println("❌ NO CHUNKS CREATED AFTER SUCCESSFUL TALLY CREATION");
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Failed to create encrypted tally automatically. The tally service succeeded but no chunks were saved. Please try creating the tally manually first.")
                        .build();
                }
                
                System.out.println("✅ TALLY AUTO-CREATION COMPLETED SUCCESSFULLY");
                System.out.println("Successfully auto-created encrypted tally for election " + request.election_id());
                System.out.println("Number of chunks: " + electionCenters.size());
            } else {
                System.out.println("✅ ENCRYPTED TALLY ALREADY EXISTS");
                System.out.println("Encrypted tally already exists for election " + request.election_id() + " (" + electionCenters.size() + " chunks)");
            }
            
            System.out.println("=== TALLY CHECK PHASE COMPLETED - PROCEEDING WITH PARTIAL DECRYPTION ===");

            // 9. ✅ Decrypt the encrypted_data from request using guardian's credentials
            String guardianCredentials = guardian.getCredentials();
            if (guardianCredentials == null || guardianCredentials.trim().isEmpty()) {
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Guardian credentials not found. Please contact the administrator.")
                    .build();
            }

            String decryptedPrivateKey;
            String decryptedPolynomial;
            try {
                System.out.println("Decrypting guardian credentials...");
                ElectionGuardCryptoService.GuardianDecryptionResult decryptionResult = cryptoService.decryptGuardianData(request.encrypted_data(), guardianCredentials);
                decryptedPrivateKey = decryptionResult.getPrivateKey();
                decryptedPolynomial = decryptionResult.getPolynomial();
                System.out.println("Successfully decrypted guardian private key and polynomial");
            } catch (Exception e) {
                System.err.println("Failed to decrypt guardian credentials: " + e.getMessage());
                return CreatePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Failed to decrypt guardian credentials. Please ensure you uploaded the correct credential file.")
                    .build();
            }

            // 10. ===== PROCESS EACH CHUNK =====
            System.out.println("=== PROCESSING " + electionCenters.size() + " CHUNKS ===");
            int processedChunks = 0;
            
            for (ElectionCenter electionCenter : electionCenters) {
                Long electionCenterId = electionCenter.getElectionCenterId();
                System.out.println("=== PROCESSING CHUNK " + (processedChunks + 1) + " (election_center_id: " + electionCenterId + ") ===");
                
                // Get encrypted tally for this chunk
                String ciphertextTallyString = electionCenter.getEncryptedTally();
                if (ciphertextTallyString == null || ciphertextTallyString.trim().isEmpty()) {
                    System.err.println("❌ No encrypted tally for chunk " + electionCenterId);
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("Chunk " + (processedChunks + 1) + " has no encrypted tally")
                        .build();
                }
                
                // Get submitted ballots for this chunk
                List<SubmittedBallot> chunkBallots = submittedBallotRepository.findByElectionCenterId(electionCenterId);
                List<String> ballotCipherTexts = chunkBallots.stream()
                    .map(SubmittedBallot::getCipherText)
                    .toList();
                System.out.println("Found " + ballotCipherTexts.size() + " ballots for chunk " + electionCenterId);
                
                // Call ElectionGuard microservice for this chunk
                ElectionGuardPartialDecryptionRequest guardRequest = ElectionGuardPartialDecryptionRequest.builder()
                    .guardian_id(String.valueOf(guardian.getSequenceOrder()))
                    // TODO: guardian_data/keyBackup removed - need to retrieve from Decryptions table
                    .guardian_data("TODO: Get from Decryptions table") // guardian.getKeyBackup()
                    .private_key(decryptedPrivateKey)
                    .public_key(guardian.getGuardianPublicKey())
                    .polynomial(decryptedPolynomial)
                    .party_names(partyNames)
                    .candidate_names(candidateNames)
                    .ciphertext_tally(ciphertextTallyString)
                    .submitted_ballots(ballotCipherTexts)
                    .joint_public_key(election.getJointPublicKey())
                    .commitment_hash(election.getBaseHash())
                    .number_of_guardians(numberOfGuardians)
                    .quorum(election.getElectionQuorum())
                    .build();
                
                System.out.println("🚀 Calling ElectionGuard service for chunk " + electionCenterId);
                ElectionGuardPartialDecryptionResponse guardResponse = callElectionGuardPartialDecryptionService(guardRequest);
                System.out.println("Received response from ElectionGuard service for chunk " + electionCenterId);
                
                // Check if tally_share is null (invalid key)
                if (guardResponse.tally_share() == null) {
                    return CreatePartialDecryptionResponse.builder()
                        .success(false)
                        .message("The credentials you provided were not right, please provide the right credential file")
                        .build();
                }
                
                // Store decryption data for this chunk in the Decryption table
                Decryption decryption = Decryption.builder()
                    .electionCenterId(electionCenterId)
                    .guardianId(guardian.getGuardianId())
                    .tallyShare(guardResponse.tally_share())
                    .guardianDecryptionKey(guardResponse.guardian_public_key())
                    .partialDecryptedTally(guardResponse.ballot_shares()) // Field is partialDecryptedTally, not ballotShares
                    .build();
                
                decryptionRepository.save(decryption);
                System.out.println("✅ Saved decryption data for chunk " + electionCenterId);
                
                processedChunks++;
            }
            
            System.out.println("=== PROCESSED " + processedChunks + " CHUNKS SUCCESSFULLY ===");
            
            // Mark guardian as having completed decryption
            guardian.setDecryptedOrNot(true);
            guardianRepository.save(guardian);
            System.out.println("✅ Guardian marked as decrypted");

            // Create compensated decryption shares for ALL other guardians using decrypted polynomial
            createCompensatedDecryptionShares(election, guardian, decryptedPrivateKey, decryptedPolynomial, electionCenters);

            return CreatePartialDecryptionResponse.builder()
                .success(true)
                .message("Partial decryption completed successfully for " + processedChunks + " chunks")
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
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
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

            // 2. Check if ciphertext_tally exists in ElectionCenter table
            // TODO: Update to use chunking - check if at least one ElectionCenter has encrypted tally
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
            if (electionCenters == null || electionCenters.isEmpty() || 
                electionCenters.stream().noneMatch(ec -> ec.getEncryptedTally() != null && !ec.getEncryptedTally().trim().isEmpty())) {
                return CombinePartialDecryptionResponse.builder()
                    .success(false)
                    .message("Election tally has not been created yet. Please create the tally first.")
                    .build();
            }

            // 3. Fetch election choices for candidate_names and party_names
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.election_id());
            // electionChoices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            
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

            // 4. Fetch submitted ballots - now linked via election_center_id
            // TODO: Update for chunking - ballots are distributed across ElectionCenters
            List<SubmittedBallot> submittedBallots = new ArrayList<>();
            for (ElectionCenter ec : electionCenters) {
                submittedBallots.addAll(submittedBallotRepository.findByElectionCenterId(ec.getElectionCenterId()));
            }
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
            // TODO: Update for chunking - getTallyShare moved to Decryptions table
            List<Guardian> availableGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() != null && g.getDecryptedOrNot())
                // .filter(g -> g.getTallyShare() != null && !g.getTallyShare().trim().isEmpty()) // Field moved
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
            // TODO: Guardian.getKeyBackup() moved to Decryptions table - implement proper lookup
            // List<String> guardianDataList = guardians.stream()
            //     .map(Guardian::getKeyBackup)
            //     .collect(Collectors.toList());
            List<String> guardianDataList = new ArrayList<>(); // Placeholder

            // Available guardian data (those who completed decryption)
            List<String> availableGuardianIds = availableGuardians.stream()
                .map(g -> String.valueOf(g.getSequenceOrder()))
                .collect(Collectors.toList());
            
            // TODO: Guardian.getGuardianDecryptionKey() moved to Decryptions table
            // List<String> availableGuardianPublicKeys = availableGuardians.stream()
            //     .map(Guardian::getGuardianDecryptionKey)
            //     .collect(Collectors.toList());
            List<String> availableGuardianPublicKeys = new ArrayList<>(); // Placeholder
            
            // TODO: Guardian.getTallyShare() moved to Decryptions table
            // List<String> availableTallyShares = availableGuardians.stream()
            //     .map(Guardian::getTallyShare)
            //     .collect(Collectors.toList());
            List<String> availableTallyShares = new ArrayList<>(); // Placeholder
            
            // TODO: Guardian.getPartialDecryptedTally() moved to Decryptions table
            // List<String> availableBallotShares = availableGuardians.stream()
            //     .map(guardian -> {
            //         if (guardian.getPartialDecryptedTally() != null && !guardian.getPartialDecryptedTally().trim().isEmpty()) {
            //             return guardian.getPartialDecryptedTally();
            //         }
            //         return "{}";
            //     })
            //     .collect(Collectors.toList());
            List<String> availableBallotShares = new ArrayList<>(); // Placeholder

            // TODO: Update for chunking - these fields moved to Decryptions table
            // Missing guardian data (those who haven't completed decryption)
            List<Guardian> missingGuardians = guardians.stream()
                .filter(g -> g.getDecryptedOrNot() == null || !g.getDecryptedOrNot())
                // .filter(g -> g.getTallyShare() == null || g.getTallyShare().trim().isEmpty()) // Field moved
                .collect(Collectors.toList());
            
            // TODO: Update compensated decryption to work with election_center_id instead of election_id
            // Get compensated decryption shares from database
            List<CompensatedDecryption> compensatedDecryptions = new ArrayList<>(); // compensatedDecryptionRepository.findByElectionId(request.election_id());
            
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
            // TODO: Update to use guardian IDs instead of sequence numbers
            // CompensatedDecryption uses missingGuardianId and compensatingGuardianId (String), not sequence numbers
            // for (CompensatedDecryption cd : compensatedDecryptions) {
            //     // Only include compensated shares for guardians who are actually missing
            //     if (missingGuardianSequences.contains(cd.getMissingGuardianSequence())) {
            //         // Add elements in the same sequential order to maintain correspondence
            //         missingGuardianIds.add(String.valueOf(cd.getMissingGuardianSequence()));
            //         compensatingGuardianIds.add(String.valueOf(cd.getCompensatingGuardianSequence()));
            //         compensatedTallyShares.add(cd.getCompensatedTallyShare());
            //         compensatedBallotShares.add(cd.getCompensatedBallotShare());
            //         
            //         System.out.println("✅ Added compensated share (index=" + (compensatedTallyShares.size() - 1) + ")");
            //     } else {
            //         System.out.println("⏭️ Skipped compensated share (not needed)");
            //     }
            // }

            // TODO: Update for chunking - encryptedTally now in ElectionCenter table
            ElectionGuardCombineDecryptionSharesRequest guardRequest = ElectionGuardCombineDecryptionSharesRequest.builder()
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                // .ciphertext_tally(election.getEncryptedTally()) // Moved to ElectionCenter table
                .ciphertext_tally("TODO: Get from ElectionCenter table")
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
    private void createCompensatedDecryptionShares(Election election, Guardian availableGuardian, String availableGuardianPrivateKey, String availableGuardianPolynomial, List<ElectionCenter> electionCenters) {
        try {
            System.out.println("Starting compensated decryption for election: " + election.getElectionId());
            System.out.println("Processing " + electionCenters.size() + " chunks");
            
            // Get all guardians for this election
            List<Guardian> allGuardians = guardianRepository.findByElectionId(election.getElectionId());
            
            // Get ALL other guardians (excluding the current guardian who is creating compensated shares)
            List<Guardian> otherGuardians = allGuardians.stream()
                .filter(g -> !g.getSequenceOrder().equals(availableGuardian.getSequenceOrder()))
                .collect(Collectors.toList());
            
            System.out.println("Total guardians: " + allGuardians.size() + 
                             ", Other guardians (excluding current): " + otherGuardians.size());
            
            // Create compensated shares for ALL other guardians for EACH chunk
            if (otherGuardians.isEmpty()) {
                System.out.println("No other guardians found, skipping compensated decryption");
                return;
            }
            
            // Process each chunk
            for (ElectionCenter electionCenter : electionCenters) {
                Long electionCenterId = electionCenter.getElectionCenterId();
                System.out.println("=== Creating compensated shares for chunk " + electionCenterId + " ===");
                
                // For each OTHER guardian, create compensated share using the current guardian
                for (Guardian otherGuardian : otherGuardians) {
                    // Check if compensated share from this specific guardian for this chunk already exists
                    // TODO: Add findByElectionCenterIdAndCompensatingGuardianIdAndMissingGuardianId to repository
                    // For now, just check by election center and missing guardian
                    List<CompensatedDecryption> specificExists = compensatedDecryptionRepository
                        .findByElectionCenterIdAndMissingGuardianId(
                            electionCenterId,
                            otherGuardian.getGuardianId()
                        );
                    
                    if (specificExists.isEmpty()) {
                        // Create compensated share from this guardian for the other guardian for this chunk
                        createCompensatedShare(election, electionCenter, availableGuardian, otherGuardian, availableGuardianPrivateKey, availableGuardianPolynomial);
                        System.out.println("✅ Created compensated share for chunk " + electionCenterId + ": Guardian " + availableGuardian.getSequenceOrder() + 
                                         " compensating for Guardian " + otherGuardian.getSequenceOrder());
                    } else {
                        System.out.println("⏭️ Compensated share already exists for chunk " + electionCenterId + ": Guardian " + availableGuardian.getSequenceOrder() + 
                                         " compensating for Guardian " + otherGuardian.getSequenceOrder());
                    }
                }
            }
            
            System.out.println("✅ Completed compensated decryption shares creation for Guardian " + availableGuardian.getSequenceOrder() + " across all chunks");
            
        } catch (Exception e) {
            System.err.println("Error creating compensated decryption shares: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Creates a compensated decryption share for a specific other guardian using a compensating guardian for a specific chunk
     */
    private void createCompensatedShare(Election election, ElectionCenter electionCenter, Guardian compensatingGuardian, Guardian otherGuardian, String compensatingGuardianPrivateKey, String compensatingGuardianPolynomial) {
        try {
            System.out.println("Creating compensated share for chunk " + electionCenter.getElectionCenterId() + ": compensating=" + compensatingGuardian.getSequenceOrder() + 
                             ", other=" + otherGuardian.getSequenceOrder());
            
            // Validate that polynomial is provided since Guardian table doesn't store it
            if (compensatingGuardianPolynomial == null || compensatingGuardianPolynomial.trim().isEmpty()) {
                System.err.println("Compensating guardian polynomial is required but not provided");
                return;
            }
            
            // Check if compensated share already exists for this chunk
            boolean existsAlready = compensatedDecryptionRepository
                .existsByElectionCenterIdAndCompensatingGuardianIdAndMissingGuardianId(
                    electionCenter.getElectionCenterId(),
                    compensatingGuardian.getGuardianId(),
                    otherGuardian.getGuardianId());
            
            if (existsAlready) {
                System.out.println("Compensated share already exists for this chunk, skipping");
                return;
            }
            
            // Build request to microservice
            // Get election choices for party and candidate names
            List<ElectionChoice> electionChoices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            List<String> candidateNames = electionChoices.stream()
                .map(ElectionChoice::getOptionTitle)
                .collect(Collectors.toList());
            List<String> partyNames = electionChoices.stream()
                .map(ElectionChoice::getPartyName)
                .filter(partyName -> partyName != null && !partyName.trim().isEmpty())
                .distinct()
                .collect(Collectors.toList());
            
            // Get submitted ballots for THIS CHUNK
            List<SubmittedBallot> submittedBallots = submittedBallotRepository.findByElectionCenterId(electionCenter.getElectionCenterId());
            List<String> ballotCipherTexts = submittedBallots.stream()
                .map(SubmittedBallot::getCipherText)
                .collect(Collectors.toList());
            
            ElectionGuardCompensatedDecryptionRequest request = ElectionGuardCompensatedDecryptionRequest.builder()
                .available_guardian_id(String.valueOf(compensatingGuardian.getSequenceOrder()))
                .missing_guardian_id(String.valueOf(otherGuardian.getSequenceOrder()))
                // TODO: guardian_data/keyBackup field removed - need to retrieve from Decryptions table
                .available_guardian_data("TODO: Get from Decryptions table")
                .missing_guardian_data("TODO: Get from Decryptions table")
                .available_private_key(compensatingGuardianPrivateKey)
                .available_public_key(compensatingGuardian.getGuardianPublicKey())
                .available_polynomial(compensatingGuardianPolynomial)
                .party_names(partyNames)
                .candidate_names(candidateNames)
                .ciphertext_tally(electionCenter.getEncryptedTally()) // Use chunk's encrypted tally
                .submitted_ballots(ballotCipherTexts) // Use chunk's ballots
                .joint_public_key(election.getJointPublicKey())
                .commitment_hash(election.getBaseHash())
                .number_of_guardians(guardianRepository.findByElectionId(election.getElectionId()).size())
                .quorum(election.getElectionQuorum())
                .build();
            
            // Call microservice
            ElectionGuardCompensatedDecryptionResponse response = callElectionGuardCompensatedDecryptionService(request);
            
            if (response == null || response.compensated_tally_share() == null) {
                System.err.println("Failed to get compensated decryption response from microservice");
                return;
            }
            
            // Save compensated decryption to database (linked to chunk)
            CompensatedDecryption compensatedDecryption = new CompensatedDecryption();
            compensatedDecryption.setElectionCenterId(electionCenter.getElectionCenterId());
            compensatedDecryption.setCompensatingGuardianId(compensatingGuardian.getGuardianId());
            compensatedDecryption.setMissingGuardianId(otherGuardian.getGuardianId());
            // Note: CompensatedDecryption uses guardian IDs, not sequence numbers directly
            compensatedDecryption.setCompensatedTallyShare(response.compensated_tally_share());
            compensatedDecryption.setCompensatedBallotShare(response.compensated_ballot_shares());
            
            compensatedDecryptionRepository.save(compensatedDecryption);
            
            System.out.println("Successfully saved compensated decryption share for chunk " + electionCenter.getElectionCenterId());
            
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
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
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
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
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
