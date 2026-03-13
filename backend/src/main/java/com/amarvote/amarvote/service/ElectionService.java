package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.BlockchainElectionResponse; // Fixed: Use Spring's HttpHeaders, not Netty's
import com.amarvote.amarvote.dto.ChunkResultResponse;
import com.amarvote.amarvote.dto.GuardianBackupSubmitRequest;
import com.amarvote.amarvote.dto.GuardianKeyCeremonySubmitRequest;
import com.amarvote.amarvote.dto.KeyCeremonyPendingElectionResponse;
import com.amarvote.amarvote.dto.KeyCeremonyStatusResponse;
import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionDetailResponse; // Added: For setting content type
import com.amarvote.amarvote.dto.ElectionGuardianSetupRequest; // Added: For handling HTTP responses
import com.amarvote.amarvote.dto.ElectionGuardianSetupResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.dto.ElectionResultsResponse;
import com.amarvote.amarvote.dto.OptimizedElectionResponse;
import com.amarvote.amarvote.dto.ActivateElectionRequest;
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.Decryption;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.BallotRepository;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ElectionService {

    private final ElectionRepository electionRepository;
    private final ObjectMapper objectMapper;
    @Autowired
    private ElectionGuardService electionGuardService;

    @Autowired
    private ElectionGuardCryptoService cryptoService;

    @Autowired
    private GuardianRepository guardianRepository;

    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;

    @Autowired
    private AllowedVoterRepository allowedVoterRepository;

    @Autowired
    private BallotRepository ballotRepository;

    @Autowired
    private ElectionCenterRepository electionCenterRepository;

    @Autowired
    private DecryptionRepository decryptionRepository;

    @Autowired
    private CompensatedDecryptionRepository compensatedDecryptionRepository;

    @Autowired
    private BlockchainService blockchainService;

    @Transactional
    public Election createElection(ElectionCreationRequest request, String jwtToken, String userEmail) {
        // Log the received token and email
        System.out.println("=========== ELECTION SERVICE ===========");
        System.out.println("Received JWT Token: " + jwtToken);
        System.out.println("Received User Email: " + userEmail);
        System.out.println("========================================");

        // Validate minimum candidate count
        if (request.candidateNames().size() < 2) {
            throw new IllegalArgumentException("At least 2 candidates are required for an election");
        }

        if (request.partyNames().size() < 2) {
            throw new IllegalArgumentException("At least 2 party names are required for an election");
        }

        // Validate candidate names are unique (case-insensitive)
        java.util.Set<String> uniqueCandidateNames = new java.util.HashSet<>();
        for (String candidateName : request.candidateNames()) {
            if (candidateName == null || candidateName.trim().isEmpty()) {
                throw new IllegalArgumentException("Candidate names cannot be empty");
            }
            String trimmedName = candidateName.trim().toLowerCase();
            if (uniqueCandidateNames.contains(trimmedName)) {
                throw new IllegalArgumentException(
                        "Candidate names must be unique - duplicate name found: " + candidateName.trim());
            }
            uniqueCandidateNames.add(trimmedName);
        }

        // Validate party names are unique (case-insensitive)
        java.util.Set<String> uniquePartyNames = new java.util.HashSet<>();
        for (String partyName : request.partyNames()) {
            if (partyName == null || partyName.trim().isEmpty()) {
                throw new IllegalArgumentException("Party names cannot be empty");
            }
            String trimmedName = partyName.trim().toLowerCase();
            if (uniquePartyNames.contains(trimmedName)) {
                throw new IllegalArgumentException(
                        "Party names must be unique - duplicate name found: " + partyName.trim());
            }
            uniquePartyNames.add(trimmedName);
        }

        // Validate candidate pictures and party pictures match names
        if (request.candidatePictures() != null
                && request.candidatePictures().size() != request.candidateNames().size()) {
            throw new IllegalArgumentException("Candidate pictures count must match candidate names");
        }

        if (request.partyPictures() != null
                && request.partyPictures().size() != request.partyNames().size()) {
            throw new IllegalArgumentException("Party pictures count must match party names");
        }

        int guardianCount = Integer.parseInt(request.guardianNumber());
        int quorum = Integer.parseInt(request.quorumNumber());

        // Create and save election FIRST to generate electionId
        Election election = new Election();
        election.setElectionTitle(request.electionTitle());
        election.setElectionDescription(request.electionDescription());
        election.setNumberOfGuardians(guardianCount);
        election.setElectionQuorum(quorum);
        election.setNoOfCandidates(request.candidateNames().size());
        election.setJointPublicKey(null);
        election.setManifestHash(null);
        election.setStatus("key_ceremony_pending");
        election.setStartingTime(null);
        election.setEndingTime(null);
        election.setBaseHash(null);
        election.setAdminEmail(userEmail); // Set admin email from request
        election.setPrivacy(request.electionPrivacy()); // Set privacy field
        election.setEligibility(request.electionEligibility()); // Set eligibility field
        Integer requestedMaxChoices = request.maxChoices();
        election.setMaxChoices(requestedMaxChoices != null ? requestedMaxChoices : 1);

        // ✅ Save to DB to get generated ID
        election = electionRepository.save(election);

        // 🔗 Create election on blockchain
        try {
            BlockchainElectionResponse blockchainResponse = blockchainService
                    .createElection(election.getElectionId().toString());
            if (blockchainResponse.isSuccess()) {
                System.out.println("✅ Election " + election.getElectionId() + " successfully created on blockchain");
                System.out.println("🔗 Transaction Hash: " + blockchainResponse.getTransactionHash());
                System.out.println("📦 Block Number: " + blockchainResponse.getBlockNumber());
            } else {
                System.err.println("⚠️ Failed to create election on blockchain: " + blockchainResponse.getMessage());
                // Continue with election creation even if blockchain fails
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error calling blockchain service: " + e.getMessage());
            // Continue with election creation even if blockchain fails
        }

        // Validate guardian email count
        List<String> guardianEmails = request.guardianEmails();
        if (guardianEmails == null || guardianEmails.isEmpty()) {
            throw new IllegalArgumentException("At least one guardian email is required");
        }

        if (guardianEmails.size() != guardianCount) {
            throw new IllegalArgumentException("Guardian emails count must match guardian number");
        }

        for (int i = 0; i < guardianEmails.size(); i++) {
            String email = guardianEmails.get(i);

            Guardian guardian = Guardian.builder()
                    .electionId(election.getElectionId())
                    .userEmail(email)
                    .guardianPublicKey(null)
                    .sequenceOrder(i + 1)
                    .decryptedOrNot(false)
                    .guardianKeySubmitted(false)
                    .credentials(null)
                    .keyBackup(null)
                    .build();

            guardianRepository.save(guardian);
        }

        System.out.println("Guardians saved successfully for decentralized key ceremony.");

        List<String> candidateNames = request.candidateNames();
        List<String> partyNames = request.partyNames();
        List<String> candidatePictures = request.candidatePictures();
        List<String> partyPictures = request.partyPictures();

        for (int i = 0; i < candidateNames.size(); i++) {
            String candidateName = candidateNames.get(i);
            String partyName = (i < partyNames.size()) ? partyNames.get(i) : null;
            String candidatePic = (candidatePictures != null && i < candidatePictures.size()) ? candidatePictures.get(i)
                    : null;
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

        // Only save voters for "listed" eligibility elections
        List<String> voterEmails = request.voterEmails();
        if ("listed".equals(request.electionEligibility()) && voterEmails != null && !voterEmails.isEmpty()) {
            for (String email : voterEmails) {
                AllowedVoter allowedVoter = AllowedVoter.builder()
                        .electionId(election.getElectionId())
                        .userEmail(email)
                        .hasVoted(false)
                        .build();

                allowedVoterRepository.save(allowedVoter);
            }
            System.out.println("Allowed voters saved successfully for listed election.");
        } else {
            System.out.println("No voters saved - election eligibility is 'unlisted' or no voter emails provided.");
        }

        return election;
    }

    public List<KeyCeremonyPendingElectionResponse> getPendingKeyCeremoniesForGuardian(String userEmail) {
        List<Guardian> guardianAssignments = guardianRepository.findByUserEmail(userEmail);
        if (guardianAssignments.isEmpty()) {
            return List.of();
        }

        return guardianAssignments.stream()
                .map(Guardian::getElectionId)
                .distinct()
                .map(electionId -> electionRepository.findById(electionId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .filter(e -> "key_ceremony_pending".equals(e.getStatus()))
                .map(e -> {
                    List<Guardian> guardians = guardianRepository.findByElectionId(e.getElectionId());
                    int total = guardians.size();
                    int submitted = (int) guardians.stream().filter(g -> Boolean.TRUE.equals(g.getGuardianKeySubmitted())).count();
                    int submittedBackups = countSubmittedBackups(guardians);
                    boolean allKeyPairsSubmitted = total > 0 && submitted == total;
                    boolean readyForActivation = allKeyPairsSubmitted && submittedBackups == total;

                    Guardian currentGuardian = guardians.stream()
                            .filter(g -> userEmail.equals(g.getUserEmail()))
                            .findFirst()
                            .orElse(null);

                    boolean guardianBackupSubmitted = currentGuardian != null && hasRequiredBackups(currentGuardian, total);

                    String currentRound;
                    if (currentGuardian == null || !Boolean.TRUE.equals(currentGuardian.getGuardianKeySubmitted())) {
                        currentRound = "keypair_generation";
                    } else if (!allKeyPairsSubmitted) {
                        currentRound = "waiting_for_all_keypairs";
                    } else if (!guardianBackupSubmitted) {
                        currentRound = "backup_key_sharing";
                    } else {
                        currentRound = "backup_submitted_waiting_others";
                    }

                    return KeyCeremonyPendingElectionResponse.builder()
                            .electionId(e.getElectionId())
                            .electionTitle(e.getElectionTitle())
                            .electionDescription(e.getElectionDescription())
                            .electionQuorum(e.getElectionQuorum())
                            .numberOfGuardians(e.getNumberOfGuardians())
                            .submittedGuardians(submitted)
                            .submittedBackupGuardians(submittedBackups)
                            .allKeyPairsSubmitted(allKeyPairsSubmitted)
                            .backupRoundOpen(allKeyPairsSubmitted)
                            .guardianBackupSubmitted(guardianBackupSubmitted)
                            .currentRound(currentRound)
                            .readyForActivation(readyForActivation)
                            .build();
                })
                .filter(p -> !p.readyForActivation())
                .collect(Collectors.toList());
    }

    public Map<String, Object> generateGuardianCredentialsForKeyCeremony(Long electionId, String userEmail) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (!"key_ceremony_pending".equals(election.getStatus())) {
            throw new IllegalArgumentException("Key ceremony is not active for this election");
        }

        List<Guardian> matched = guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail);
        if (matched.isEmpty()) {
            throw new IllegalArgumentException("You are not assigned as a guardian for this election");
        }

        Guardian guardian = matched.get(0);

        if (Boolean.TRUE.equals(guardian.getGuardianKeySubmitted())) {
            throw new IllegalArgumentException("Guardian key already submitted");
        }

        String response = electionGuardService.postRequest("/generate_guardian_credentials", Map.of(
                "guardian_id", String.valueOf(guardian.getSequenceOrder()),
                "sequence_order", guardian.getSequenceOrder(),
                "number_of_guardians", election.getNumberOfGuardians(),
                "quorum", election.getElectionQuorum()));

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> generated = objectMapper.readValue(response, Map.class);

            if (!"success".equals(String.valueOf(generated.get("status")))) {
                throw new RuntimeException("Failed to generate guardian credentials");
            }

            String privateKeyJson = objectMapper.writeValueAsString(generated.get("private_key"));
            String polynomialJson = objectMapper.writeValueAsString(generated.get("polynomial"));

            return Map.of(
                    "success", true,
                    "electionId", electionId,
                    "guardianId", guardian.getGuardianId(),
                    "sequenceOrder", guardian.getSequenceOrder(),
                    "guardianPrivateKey", privateKeyJson,
                    "guardianPublicKey", objectMapper.writeValueAsString(generated.get("public_key")),
                    "guardianPolynomial", polynomialJson,
                    "guardianKeyBackup", objectMapper.writeValueAsString(generated.get("guardian_data")));
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse generated guardian credentials", e);
        }
    }

    @Transactional
    public Map<String, Object> submitGuardianKeyCeremony(GuardianKeyCeremonySubmitRequest request, String userEmail) {
        Optional<Election> electionOpt = electionRepository.findById(request.electionId());
        if (electionOpt.isEmpty()) {
            throw new IllegalArgumentException("Election not found");
        }

        Election election = electionOpt.get();
        if (!"key_ceremony_pending".equals(election.getStatus())) {
            throw new IllegalArgumentException("Key ceremony is not active for this election");
        }

        List<Guardian> matched = guardianRepository.findByElectionIdAndUserEmail(request.electionId(), userEmail);
        if (matched.isEmpty()) {
            throw new IllegalArgumentException("You are not assigned as a guardian for this election");
        }

        Guardian guardian = matched.get(0);
        if (Boolean.TRUE.equals(guardian.getGuardianKeySubmitted())) {
            throw new IllegalArgumentException("Guardian key already submitted");
        }

        guardian.setGuardianPublicKey(request.guardianPublicKey());
        if (request.guardianKeyBackup() != null && !request.guardianKeyBackup().isBlank()) {
            guardian.setKeyBackup(request.guardianKeyBackup());
        }

        if (request.localEncryptionPassword() == null || request.localEncryptionPassword().isBlank()) {
            throw new IllegalArgumentException("Local encryption password is required");
        }

        if (request.guardianPrivateKey() == null || request.guardianPrivateKey().isBlank()) {
            throw new IllegalArgumentException("Guardian private key is required");
        }

        if (request.guardianPolynomial() == null || request.guardianPolynomial().isBlank()) {
            throw new IllegalArgumentException("Guardian polynomial is required");
        }

        ElectionGuardCryptoService.EncryptionResult encryptionResult =
                cryptoService.encryptGuardianData(
                        request.guardianPrivateKey(),
                        request.guardianPolynomial(),
                        request.localEncryptionPassword());

        guardian.setCredentials(encryptionResult.getCredentials());

        guardian.setGuardianKeySubmitted(true);
        guardianRepository.save(guardian);

        int total = guardianRepository.countByElectionId(request.electionId());
        int submitted = guardianRepository.countSubmittedKeysByElectionId(request.electionId());

        return Map.of(
                "success", true,
                "message", "Guardian key ceremony data submitted successfully",
                "encryptedCredential", encryptionResult.getEncryptedData(),
                "credentialFormat", "legacy_credentials_txt",
                "submittedGuardians", submitted,
                "submittedBackupGuardians", countSubmittedBackups(guardianRepository.findByElectionId(request.electionId())),
                "totalGuardians", total,
                "allSubmitted", submitted == total && total > 0,
                "backupRoundOpen", submitted == total && total > 0);
    }

    public Map<String, Object> getGuardianBackupRoundContext(Long electionId, String userEmail) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (!"key_ceremony_pending".equals(election.getStatus())) {
            throw new IllegalArgumentException("Key ceremony is not active for this election");
        }

        List<Guardian> guardians = guardianRepository.findByElectionIdOrderBySequenceOrder(electionId);
        if (guardians.isEmpty()) {
            throw new IllegalArgumentException("No guardians found for election");
        }

        Guardian currentGuardian = guardians.stream()
                .filter(g -> userEmail.equals(g.getUserEmail()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("You are not assigned as a guardian for this election"));

        if (!Boolean.TRUE.equals(currentGuardian.getGuardianKeySubmitted())) {
            throw new IllegalArgumentException("Submit your keypair first before backup key sharing");
        }

        int total = guardians.size();
        int submitted = (int) guardians.stream().filter(g -> Boolean.TRUE.equals(g.getGuardianKeySubmitted())).count();
        boolean backupRoundOpen = total > 0 && submitted == total;

        List<Map<String, Object>> recipients = guardians.stream()
                .filter(g -> !g.getGuardianId().equals(currentGuardian.getGuardianId()))
            .map(g -> {
                Map<String, Object> item = new HashMap<>();
                item.put("guardianId", String.valueOf(g.getSequenceOrder()));
                item.put("sequenceOrder", g.getSequenceOrder());
                item.put("publicKey", extractPublicKeyValue(g.getGuardianPublicKey()));
                return item;
            })
                .collect(Collectors.toList());

        return Map.of(
                "success", true,
                "electionId", electionId,
                "backupRoundOpen", backupRoundOpen,
                "submittedGuardians", submitted,
                "totalGuardians", total,
                "guardianBackupSubmitted", hasRequiredBackups(currentGuardian, total),
                "senderGuardian", Map.of(
                        "guardianId", String.valueOf(currentGuardian.getSequenceOrder()),
                    "sequenceOrder", currentGuardian.getSequenceOrder(),
                    "publicKey", extractPublicKeyValue(currentGuardian.getGuardianPublicKey())
                ),
                "recipients", recipients,
                "message", backupRoundOpen
                        ? "Backup key sharing round is open"
                        : "Backup key sharing starts after all guardians submit keypairs");
    }

    @Transactional
    public Map<String, Object> submitGuardianBackupRound(GuardianBackupSubmitRequest request, String userEmail) {
        Election election = electionRepository.findById(request.electionId())
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (!"key_ceremony_pending".equals(election.getStatus())) {
            throw new IllegalArgumentException("Key ceremony is not active for this election");
        }

        List<Guardian> guardians = guardianRepository.findByElectionIdOrderBySequenceOrder(request.electionId());
        if (guardians.isEmpty()) {
            throw new IllegalArgumentException("No guardians found for election");
        }

        Guardian currentGuardian = guardians.stream()
                .filter(g -> userEmail.equals(g.getUserEmail()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("You are not assigned as a guardian for this election"));

        if (!Boolean.TRUE.equals(currentGuardian.getGuardianKeySubmitted())) {
            throw new IllegalArgumentException("Submit your keypair first before backup key sharing");
        }

        int total = guardians.size();
        boolean allKeyPairsSubmitted = guardians.stream().allMatch(g -> Boolean.TRUE.equals(g.getGuardianKeySubmitted()));
        if (!allKeyPairsSubmitted) {
            throw new IllegalArgumentException("Backup key sharing starts only after all guardians submit keypairs");
        }

        validateBackupPayload(request.guardianKeyBackup(), currentGuardian, guardians);

        currentGuardian.setKeyBackup(request.guardianKeyBackup());
        guardianRepository.save(currentGuardian);

        int submittedBackups = countSubmittedBackups(guardians);

        return Map.of(
                "success", true,
                "message", "Encrypted backup shares submitted successfully",
                "submittedBackupGuardians", submittedBackups,
                "totalGuardians", total,
                "allBackupsSubmitted", submittedBackups == total,
                "readyForActivation", submittedBackups == total
        );
    }

    @Transactional
    public Map<String, Object> generateGuardianBackupRoundShares(Long electionId, String userEmail, String encryptedCredential) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (!"key_ceremony_pending".equals(election.getStatus())) {
            throw new IllegalArgumentException("Key ceremony is not active for this election");
        }

        List<Guardian> guardians = guardianRepository.findByElectionIdOrderBySequenceOrder(electionId);
        if (guardians.isEmpty()) {
            throw new IllegalArgumentException("No guardians found for election");
        }

        Guardian currentGuardian = guardians.stream()
                .filter(g -> userEmail.equals(g.getUserEmail()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("You are not assigned as a guardian for this election"));

        if (!Boolean.TRUE.equals(currentGuardian.getGuardianKeySubmitted())) {
            throw new IllegalArgumentException("Submit your keypair first before backup key sharing");
        }

        boolean allKeyPairsSubmitted = guardians.stream().allMatch(g -> Boolean.TRUE.equals(g.getGuardianKeySubmitted()));
        if (!allKeyPairsSubmitted) {
            throw new IllegalArgumentException("Backup key sharing starts only after all guardians submit keypairs");
        }

        if (encryptedCredential == null || encryptedCredential.isBlank()) {
            throw new IllegalArgumentException("Encrypted credential data is required");
        }

        String credentialMetadata = currentGuardian.getCredentials();
        if (credentialMetadata == null || credentialMetadata.isBlank()) {
            throw new IllegalArgumentException("Credential metadata is not available");
        }

        ElectionGuardCryptoService.GuardianDecryptionResult decrypted =
                cryptoService.decryptGuardianData(encryptedCredential, credentialMetadata);

        String senderPublicKey = extractPublicKeyValue(currentGuardian.getGuardianPublicKey());
        if (senderPublicKey == null || senderPublicKey.isBlank()) {
            throw new IllegalArgumentException("Sender public key is missing");
        }

        List<Map<String, Object>> recipients = guardians.stream()
                .filter(g -> !g.getGuardianId().equals(currentGuardian.getGuardianId()))
                .map(g -> {
                    String recipientPublicKey = extractPublicKeyValue(g.getGuardianPublicKey());
                    if (recipientPublicKey == null || recipientPublicKey.isBlank()) {
                        throw new IllegalArgumentException("Missing public key for recipient guardian " + g.getSequenceOrder());
                    }
                    Map<String, Object> item = new HashMap<>();
                    item.put("guardian_id", String.valueOf(g.getSequenceOrder()));
                    item.put("sequence_order", g.getSequenceOrder());
                    item.put("public_key", recipientPublicKey);
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender_guardian_id", String.valueOf(currentGuardian.getSequenceOrder()));
        payload.put("sender_sequence_order", currentGuardian.getSequenceOrder());
        payload.put("number_of_guardians", election.getNumberOfGuardians());
        payload.put("quorum", election.getElectionQuorum());
        payload.put("sender_private_key", parseJsonToObject(decrypted.getPrivateKey()));
        payload.put("sender_public_key", senderPublicKey);
        payload.put("sender_polynomial", parseJsonToObject(decrypted.getPolynomial()));
        payload.put("recipients", recipients);

        String microserviceResponse = electionGuardService.postRequest("/generate_guardian_backup_shares", payload);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(microserviceResponse, Map.class);
            if (!"success".equals(String.valueOf(parsed.get("status")))) {
                throw new IllegalArgumentException(String.valueOf(parsed.get("message")));
            }

            Object guardianDataObj = parsed.get("guardian_data");
            if (guardianDataObj == null) {
                throw new IllegalArgumentException("Microservice did not return guardian_data");
            }

            String guardianDataJson = objectMapper.writeValueAsString(guardianDataObj);
            validateBackupPayload(guardianDataJson, currentGuardian, guardians);

            currentGuardian.setKeyBackup(guardianDataJson);
            guardianRepository.save(currentGuardian);

            int submittedBackups = countSubmittedBackups(guardianRepository.findByElectionIdOrderBySequenceOrder(electionId));

            return Map.of(
                    "success", true,
                    "message", "Encrypted backup shares generated successfully",
                    "guardianData", guardianDataObj,
                    "backupCount", parsed.getOrDefault("backup_count", recipients.size()),
                    "submittedBackupGuardians", submittedBackups,
                    "totalGuardians", guardians.size(),
                    "allBackupsSubmitted", submittedBackups == guardians.size(),
                    "readyForActivation", submittedBackups == guardians.size());
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to generate guardian backup shares", e);
        }
    }

    public Map<String, Object> getGuardianCredentialMetadataForBackup(Long electionId, String userEmail) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (!"key_ceremony_pending".equals(election.getStatus())) {
            throw new IllegalArgumentException("Key ceremony is not active for this election");
        }

        List<Guardian> guardians = guardianRepository.findByElectionIdOrderBySequenceOrder(electionId);
        if (guardians.isEmpty()) {
            throw new IllegalArgumentException("No guardians found for election");
        }

        Guardian currentGuardian = guardians.stream()
                .filter(g -> userEmail.equals(g.getUserEmail()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("You are not assigned as a guardian for this election"));

        if (!Boolean.TRUE.equals(currentGuardian.getGuardianKeySubmitted())) {
            throw new IllegalArgumentException("Submit your keypair first before backup key sharing");
        }

        String credentialMetadata = currentGuardian.getCredentials();
        if (credentialMetadata == null || credentialMetadata.isBlank()) {
            throw new IllegalArgumentException("Guardian credential metadata is not available");
        }

        return Map.of(
                "success", true,
                "electionId", electionId,
                "guardianId", String.valueOf(currentGuardian.getSequenceOrder()),
                "credentialMetadata", credentialMetadata
        );
    }

    public KeyCeremonyStatusResponse getKeyCeremonyStatus(Long electionId, String userEmail) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (election.getAdminEmail() == null || !election.getAdminEmail().equals(userEmail)) {
            throw new IllegalArgumentException("Only the election admin can access waiting room status");
        }

        List<Guardian> guardians = guardianRepository.findByElectionId(electionId);
        int total = guardians.size();
        int submitted = (int) guardians.stream().filter(g -> Boolean.TRUE.equals(g.getGuardianKeySubmitted())).count();
        int submittedBackups = countSubmittedBackups(guardians);
        boolean allKeyPairsSubmitted = total > 0 && submitted == total;
        boolean allBackupsSubmitted = total > 0 && submittedBackups == total;

        return KeyCeremonyStatusResponse.builder()
                .electionId(electionId)
                .electionTitle(election.getElectionTitle())
                .totalGuardians(total)
                .submittedGuardians(submitted)
            .submittedBackupGuardians(submittedBackups)
                .quorum(election.getElectionQuorum())
            .allSubmitted(allKeyPairsSubmitted)
            .allBackupsSubmitted(allBackupsSubmitted)
            .backupRoundOpen(allKeyPairsSubmitted)
            .currentRound(allKeyPairsSubmitted ? "backup_key_sharing" : "keypair_generation")
            .readyForActivation(allBackupsSubmitted)
                .build();
    }

    @Transactional
    public Map<String, Object> activateElectionAfterKeyCeremony(ActivateElectionRequest request, String userEmail) {
        Election election = electionRepository.findById(request.electionId())
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (election.getAdminEmail() == null || !election.getAdminEmail().equals(userEmail)) {
            throw new IllegalArgumentException("Only the election admin can activate the election");
        }

        if (!request.endingTime().isAfter(request.startingTime())) {
            throw new IllegalArgumentException("Ending time must be after starting time");
        }

        List<Guardian> guardians = guardianRepository.findByElectionIdOrderBySequenceOrder(request.electionId());
        if (guardians.isEmpty()) {
            throw new IllegalArgumentException("No guardians found for election");
        }

        boolean allSubmitted = guardians.stream().allMatch(g -> Boolean.TRUE.equals(g.getGuardianKeySubmitted()));
        if (!allSubmitted) {
            throw new IllegalArgumentException("All guardians must submit public keys before activation");
        }

        boolean allBackupsSubmitted = guardians.stream().allMatch(g -> hasRequiredBackups(g, guardians.size()));
        if (!allBackupsSubmitted) {
            throw new IllegalArgumentException("All guardians must complete backup key sharing before activation");
        }

        List<String> publicKeys = guardians.stream()
            .map(g -> extractPublicKeyValue(g.getGuardianPublicKey()))
                .filter(k -> k != null && !k.isBlank())
                .collect(Collectors.toList());

        if (publicKeys.size() != guardians.size()) {
            throw new IllegalArgumentException("Some guardian public keys are missing");
        }

        List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(request.electionId());
        List<String> candidateNames = choices.stream().map(ElectionChoice::getOptionTitle).collect(Collectors.toList());
        List<String> partyNames = choices.stream().map(ElectionChoice::getPartyName).collect(Collectors.toList());

        String combineResponse = electionGuardService.postRequest("/combine_guardian_public_keys", Map.of(
                "public_keys", publicKeys,
                "number_of_guardians", guardians.size(),
                "quorum", election.getElectionQuorum(),
                "party_names", partyNames,
                "candidate_names", candidateNames));

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> combined = objectMapper.readValue(combineResponse, Map.class);

            String status = (String) combined.get("status");
            if (!"success".equals(status)) {
                throw new RuntimeException("Failed to combine guardian public keys");
            }

            election.setJointPublicKey(String.valueOf(combined.get("joint_public_key")));
            election.setBaseHash(String.valueOf(combined.get("commitment_hash")));
            election.setManifestHash(String.valueOf(combined.get("manifest")));
            election.setStartingTime(request.startingTime());
            election.setEndingTime(request.endingTime());
            election.setStatus("draft");
            electionRepository.save(election);

            return Map.of(
                    "success", true,
                    "message", "Election activated successfully",
                    "jointPublicKey", election.getJointPublicKey(),
                    "startingTime", election.getStartingTime(),
                    "endingTime", election.getEndingTime());
        } catch (Exception e) {
            throw new RuntimeException("Failed to finalize key ceremony activation", e);
        }
    }

    public Map<String, Object> getGuardianLocalDecryptionPassword(Long electionId, String userEmail) {
        List<Guardian> matched = guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail);
        if (matched.isEmpty()) {
            throw new IllegalArgumentException("You are not assigned as a guardian for this election");
        }

        Guardian guardian = matched.get(0);
        if (guardian.getCredentials() == null || guardian.getCredentials().isBlank()) {
            throw new IllegalArgumentException("Guardian credential is not available");
        }

        return Map.of(
                "success", false,
                "electionId", electionId,
                "guardianId", guardian.getGuardianId(),
                "message", "Password retrieval is not available. Use your downloaded credentials.txt file for decryption.");
    }

    private String extractPublicKeyValue(String guardianPublicKey) {
        if (guardianPublicKey == null || guardianPublicKey.isBlank()) {
            return null;
        }

        String trimmed = guardianPublicKey.trim();
        if (trimmed.chars().allMatch(Character::isDigit)) {
            return trimmed;
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(trimmed, Map.class);
            Object value = parsed.get("public_key");
            if (value == null) {
                value = parsed.get("publicKey");
            }
            return value == null ? null : String.valueOf(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid guardian public key format");
        }
    }

    private Object parseJsonToObject(String jsonOrText) {
        if (jsonOrText == null) {
            return null;
        }

        String trimmed = jsonOrText.trim();
        if (trimmed.isBlank()) {
            return trimmed;
        }

        try {
            return objectMapper.readValue(trimmed, Object.class);
        } catch (Exception e) {
            return trimmed;
        }
    }

    private int countSubmittedBackups(List<Guardian> guardians) {
        int total = guardians.size();
        return (int) guardians.stream().filter(g -> hasRequiredBackups(g, total)).count();
    }

    private boolean hasRequiredBackups(Guardian guardian, int totalGuardians) {
        if (guardian == null || guardian.getKeyBackup() == null || guardian.getKeyBackup().isBlank()) {
            return false;
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(guardian.getKeyBackup(), Map.class);
            Object backupsObj = parsed.get("backups");
            if (!(backupsObj instanceof Map<?, ?> backupsMap)) {
                return false;
            }
            int expected = Math.max(totalGuardians - 1, 0);
            return backupsMap.size() >= expected;
        } catch (Exception e) {
            return false;
        }
    }

    private void validateBackupPayload(String guardianKeyBackup, Guardian currentGuardian, List<Guardian> allGuardians) {
        if (guardianKeyBackup == null || guardianKeyBackup.isBlank()) {
            throw new IllegalArgumentException("Guardian backup payload is required");
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(guardianKeyBackup, Map.class);

            Object ownerIdObj = parsed.get("id");
            if (ownerIdObj == null || !String.valueOf(ownerIdObj).equals(String.valueOf(currentGuardian.getSequenceOrder()))) {
                throw new IllegalArgumentException("Backup payload owner does not match authenticated guardian");
            }

            Object backupsObj = parsed.get("backups");
            if (!(backupsObj instanceof Map<?, ?> backupsMap)) {
                throw new IllegalArgumentException("Backup payload must contain encrypted backups map");
            }

            List<String> expectedGuardianIds = allGuardians.stream()
                    .filter(g -> !g.getGuardianId().equals(currentGuardian.getGuardianId()))
                    .map(g -> String.valueOf(g.getSequenceOrder()))
                    .collect(Collectors.toList());

            List<String> presentGuardianIds = backupsMap.keySet().stream()
                    .map(String::valueOf)
                    .collect(Collectors.toList());

            for (String expectedGuardianId : expectedGuardianIds) {
                if (!presentGuardianIds.contains(expectedGuardianId)) {
                    throw new IllegalArgumentException("Missing encrypted backup for guardian " + expectedGuardianId);
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid guardian backup payload format");
        }
    }

    /**
     * Get all elections that are accessible to a specific user
     * This includes:
     * 1. All elections where the user is in the allowed voters list
     * 2. All elections where the user is the admin (admin_email matches)
     * 3. All elections where the user is a guardian
     * 
     * Optimized implementation to retrieve all required election data in a single
     * query
     * to avoid N+1 query problems when fetching hundreds of elections.
     */
    public List<ElectionResponse> getAllAccessibleElections(String userEmail) {
        System.out.println("Fetching optimized accessible elections for user: " + userEmail);
        long startTime = System.currentTimeMillis();

        List<Object[]> queryResults = electionRepository.findOptimizedAccessibleElectionsWithDetails(userEmail);

        // Convert query results to DTOs
        List<OptimizedElectionResponse> optimizedResponses = queryResults.stream()
                .map(OptimizedElectionResponse::fromQueryResult)
                .collect(Collectors.toList());

        // Convert to ElectionResponse for backward compatibility
        List<ElectionResponse> responses = optimizedResponses.stream()
                .map(opt -> ElectionResponse.builder()
                        .electionId(opt.getElectionId())
                        .electionTitle(opt.getElectionTitle())
                        .electionDescription(opt.getElectionDescription())
                        .status(opt.getStatus())
                        .startingTime(opt.getStartingTime())
                        .endingTime(opt.getEndingTime())
                        .profilePic(opt.getProfilePic())
                        .adminEmail(opt.getAdminEmail())
                        .adminName(opt.getAdminName())
                        .numberOfGuardians(opt.getNumberOfGuardians())
                        .electionQuorum(opt.getElectionQuorum())
                        .noOfCandidates(opt.getNoOfCandidates())
                        .createdAt(opt.getCreatedAt())
                        .userRoles(opt.getUserRoles())
                        .isPublic(opt.getIsPublic())
                        .eligibility(opt.getEligibility())
                        .hasVoted(opt.getHasVoted())
                        .build())
                .collect(Collectors.toList());

        long endTime = System.currentTimeMillis();
        System.out.println("Found " + responses.size() + " accessible elections for user: " + userEmail +
                " in " + (endTime - startTime) + "ms");

        return responses;
    }

    /**
     * Get all elections where user is in allowed voters
     */
    public List<ElectionResponse> getElectionsForUser(String userEmail) {
        List<Election> elections = electionRepository.findElectionsForUser(userEmail);
        return elections.stream()
                .map(election -> convertToElectionResponse(election, userEmail))
                .collect(Collectors.toList());
    }

    /**
     * Get all elections where user is admin
     */
    public List<ElectionResponse> getElectionsByAdmin(String userEmail) {
        List<Election> elections = electionRepository.findElectionsByAdmin(userEmail);
        return elections.stream()
                .map(election -> convertToElectionResponse(election, userEmail))
                .collect(Collectors.toList());
    }

    /**
     * Get all elections where user is guardian
     */
    public List<ElectionResponse> getElectionsByGuardian(String userEmail) {
        List<Election> elections = electionRepository.findElectionsByGuardian(userEmail);
        return elections.stream()
                .map(election -> convertToElectionResponse(election, userEmail))
                .collect(Collectors.toList());
    }

    /**
     * Convert Election entity to ElectionResponse DTO with user roles
     * 
     * NOTE: This method is now primarily used for individual election fetches.
     * For fetching multiple elections (like in getAllAccessibleElections),
     * we use a more optimized approach with batch fetching to avoid N+1 query
     * problems.
     * 
     * @see #getAllAccessibleElections(String)
     */
    private ElectionResponse convertToElectionResponse(Election election, String userEmail) {
        // Determine user roles for this election
        List<String> userRoles = new ArrayList<>();

        // Check if user is admin
        if (election.getAdminEmail() != null && election.getAdminEmail().equals(userEmail)) {
            userRoles.add("admin");
        }

        // Check if user is in allowed voters
        Optional<AllowedVoter> allowedVoterOpt = allowedVoterRepository.findByElectionIdAndUserEmail(election.getElectionId(),
                userEmail);
        if (allowedVoterOpt.isPresent()) {
            userRoles.add("voter");
        }

        // Check if user is guardian
        List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(election.getElectionId(), userEmail);
        if (!guardians.isEmpty()) {
            userRoles.add("guardian");
        }

        // Determine if election is public or private based on privacy field
        boolean isPublic = "public".equals(election.getPrivacy());

        // Check if user has already voted in this election
        boolean hasVoted = allowedVoterOpt.isPresent() && allowedVoterOpt.get().getHasVoted();

        // Get admin name - just use email since we don't have User table
        String adminName = election.getAdminEmail();

        return ElectionResponse.builder()
                .electionId(election.getElectionId())
                .electionTitle(election.getElectionTitle())
                .electionDescription(election.getElectionDescription())
                .status(election.getStatus())
                .startingTime(election.getStartingTime())
                .endingTime(election.getEndingTime())
                .profilePic(election.getProfilePic())
                .adminEmail(election.getAdminEmail())
                .adminName(adminName)
                .numberOfGuardians(election.getNumberOfGuardians())
                .electionQuorum(election.getElectionQuorum())
                .noOfCandidates(election.getNoOfCandidates())
                .createdAt(election.getCreatedAt())
                .userRoles(userRoles)
                .isPublic(isPublic)
                .eligibility(election.getEligibility())
                .hasVoted(hasVoted)
                .build();
    }

    /**
     * Get detailed election information by ID
     * Returns election details if the user is authorized to view it
     * Authorization rules:
     * 1. User is the admin
     * 2. User is a guardian
     * 3. User is a voter
     * 4. Election is public (no allowed voters)
     * 
     * @param electionId The ID of the election to retrieve
     * @param userEmail  The email of the user requesting the election
     * @return ElectionDetailResponse if authorized, null if not authorized
     */
    public ElectionDetailResponse getElectionById(Long electionId, String userEmail) {
        System.out.println("Fetching election details for ID: " + electionId + " by user: " + userEmail);

        // First, check if the election exists
        Optional<Election> electionOpt = electionRepository.findById(electionId);
        if (!electionOpt.isPresent()) {
            System.out.println("Election not found: " + electionId);
            return null;
        }

        Election election = electionOpt.get();

        // Check if user is authorized to view this election
        if (!isUserAuthorizedToViewElection(election, userEmail)) {
            System.out.println("User " + userEmail + " is not authorized to view election " + electionId);
            return null;
        }

        System.out.println("User " + userEmail + " is authorized to view election " + electionId);

        // Build the detailed response
        return buildElectionDetailResponse(election, userEmail);
    }

    /**
     * Check if user is authorized to view the election
     */
    private boolean isUserAuthorizedToViewElection(Election election, String userEmail) {
        // Check if user is the admin
        if (election.getAdminEmail() != null && election.getAdminEmail().equals(userEmail)) {
            System.out.println("User is admin of election " + election.getElectionId());
            return true;
        }

        // Check if user is a guardian
        List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(election.getElectionId(), userEmail);
        if (!guardians.isEmpty()) {
            System.out.println("User is guardian of election " + election.getElectionId());
            return true;
        }

        // Check if user is a voter
        Optional<AllowedVoter> allowedVoterOpt = allowedVoterRepository.findByElectionIdAndUserEmail(election.getElectionId(),
                userEmail);
        if (allowedVoterOpt.isPresent()) {
            System.out.println("User is voter of election " + election.getElectionId());
            return true;
        }

        // Check if election is public (privacy = 'public')
        if ("public".equals(election.getPrivacy())) {
            System.out.println("Election " + election.getElectionId() + " is public");
            return true;
        }

        System.out.println("User is not authorized to view election " + election.getElectionId());
        return false;
    }

    /**
     * Build detailed election response with all related information
     */
    private ElectionDetailResponse buildElectionDetailResponse(Election election, String userEmail) {
        // Get user roles for this election
        List<String> userRoles = getUserRolesForElection(election, userEmail);

        // Check if election is public based on privacy field
        Boolean isPublic = "public".equals(election.getPrivacy());

        // Get guardians with user details
        List<ElectionDetailResponse.GuardianInfo> guardians = getGuardianInfoForElection(election.getElectionId(),
                userEmail);

        // Calculate guardian progress
        int totalGuardians = guardians.size();
        int guardiansSubmitted = (int) guardians.stream()
            .filter(guardian -> guardian.getDecryptedOrNot() != null && guardian.getDecryptedOrNot())
                .count();

        if ("key_ceremony_pending".equals(election.getStatus())) {
            guardiansSubmitted = (int) guardians.stream()
                .filter(guardian -> guardian.getGuardianPublicKey() != null && !guardian.getGuardianPublicKey().isBlank())
                .count();
        }
        boolean allGuardiansSubmitted = totalGuardians > 0 && guardiansSubmitted == totalGuardians;

        // Get voters with user details
        List<ElectionDetailResponse.VoterInfo> voters = getVoterInfoForElection(election.getElectionId(), userEmail);

        // Get election choices
        List<ElectionDetailResponse.ElectionChoiceInfo> electionChoices = getElectionChoicesForElection(
                election.getElectionId());

        // Get admin name - just use email since we don't have User table
        String adminName = election.getAdminEmail();

        return ElectionDetailResponse.builder()
                .electionId(election.getElectionId())
                .electionTitle(election.getElectionTitle())
                .electionDescription(election.getElectionDescription())
                .numberOfGuardians(election.getNumberOfGuardians())
                .electionQuorum(election.getElectionQuorum())
                .noOfCandidates(election.getNoOfCandidates())
                .maxChoices(election.getMaxChoices())
                .jointPublicKey(election.getJointPublicKey())
                .manifestHash(election.getManifestHash())
                .status(election.getStatus())
                .startingTime(election.getStartingTime())
                .endingTime(election.getEndingTime())
                // .encryptedTally(election.getEncryptedTally()) // Removed - now in ElectionCenter table
                .baseHash(election.getBaseHash())
                .createdAt(election.getCreatedAt())
                .profilePic(election.getProfilePic())
                .adminEmail(election.getAdminEmail())
                .adminName(adminName)
                .guardians(guardians)
                .totalGuardians(totalGuardians)
                .guardiansSubmitted(guardiansSubmitted)
                .allGuardiansSubmitted(allGuardiansSubmitted)
                .voters(voters)
                .electionChoices(electionChoices)
                .userRoles(userRoles)
                .isPublic(isPublic)
                .eligibility(election.getEligibility())
                .build();
    }

    /**
     * Get user roles for a specific election
     */
    private List<String> getUserRolesForElection(Election election, String userEmail) {
        List<String> userRoles = new ArrayList<>();

        // Check if user is admin
        if (election.getAdminEmail() != null && election.getAdminEmail().equals(userEmail)) {
            userRoles.add("admin");
        }

        // Check if user is in allowed voters
        Optional<AllowedVoter> allowedVoterOpt = allowedVoterRepository.findByElectionIdAndUserEmail(election.getElectionId(),
                userEmail);
        if (allowedVoterOpt.isPresent()) {
            userRoles.add("voter");
        }

        // Check if user is guardian
        List<Guardian> guardians = guardianRepository.findByElectionIdAndUserEmail(election.getElectionId(), userEmail);
        if (!guardians.isEmpty()) {
            userRoles.add("guardian");
        }

        return userRoles;
    }

    /**
     * Get guardian information for an election
     */
    private List<ElectionDetailResponse.GuardianInfo> getGuardianInfoForElection(Long electionId,
            String currentUserEmail) {
        List<Guardian> guardians = guardianRepository.findByElectionId(electionId);

        return guardians.stream()
                .map(guardian -> {
                    return ElectionDetailResponse.GuardianInfo.builder()
                            .guardianId(guardian.getGuardianId()) // Added: Include guardian ID
                            .userEmail(guardian.getUserEmail())
                            .userName(guardian.getUserEmail()) // Use email as name
                            .guardianPublicKey(guardian.getGuardianPublicKey())
                            .sequenceOrder(guardian.getSequenceOrder())
                            .guardianKeySubmitted(guardian.getGuardianKeySubmitted())
                            .decryptedOrNot(guardian.getDecryptedOrNot())
                            .partialDecryptedTally(null) // Now in Decryptions table
                            .proof(null) // Removed field
                            .isCurrentUser(guardian.getUserEmail().equals(currentUserEmail))
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Get voter information for an election
     */
    private List<ElectionDetailResponse.VoterInfo> getVoterInfoForElection(Long electionId, String currentUserEmail) {
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionId(electionId);

        return allowedVoters.stream()
                .map(allowedVoter -> {
                    return ElectionDetailResponse.VoterInfo.builder()
                            .userEmail(allowedVoter.getUserEmail())
                            .userName(allowedVoter.getUserEmail()) // Use email as name
                            .hasVoted(allowedVoter.getHasVoted())
                            .isCurrentUser(allowedVoter.getUserEmail().equals(currentUserEmail))
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Get election choices for an election
     */
    private List<ElectionDetailResponse.ElectionChoiceInfo> getElectionChoicesForElection(Long electionId) {
        List<ElectionChoice> choices = electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId);
        // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));

        return choices.stream()
                .map(choice -> ElectionDetailResponse.ElectionChoiceInfo.builder()
                        .choiceId(choice.getChoiceId())
                        .optionTitle(choice.getOptionTitle())
                        .optionDescription(choice.getOptionDescription())
                        .partyName(choice.getPartyName())
                        .candidatePic(choice.getCandidatePic())
                        .partyPic(choice.getPartyPic())
                        .totalVotes(choice.getTotalVotes())
                        .build())
                .collect(Collectors.toList());
    }

    private ElectionGuardianSetupResponse callElectionGuardService(ElectionGuardianSetupRequest request) {
        try {
            String url = "/setup_guardians";
            // System.out.println("Trying to connect to backend...");
            // String response = webClient.get()
            // .uri("http://host.docker.internal:5000/health") // 👈 Use
            // host.docker.internal
            // .retrieve()
            // .bodyToMono(String.class)
            // .block();
            // return "Backend response: " + response;
            System.out.println("Calling ElectionGuard service at: " + url);
            // HttpHeaders headers = new HttpHeaders();
            // headers.setContentType(MediaType.APPLICATION_JSON);

            // HttpEntity<ElectionGuardianSetupRequest> entity = new HttpEntity<>(request,
            // headers);
            // ResponseEntity<String> response = restTemplate.postForEntity(url, entity,
            // String.class);
            // System.out.println("Sending request to ElectionGuard service: " + request);
            String response = electionGuardService.postRequest(url, request);
            // System.out.println("Received response from ElectionGuard service: " +
            // response);
            if (response == null) {
                throw new RuntimeException("Invalid response from ElectionGuard service");
            }
            return objectMapper.readValue(response, ElectionGuardianSetupResponse.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to call ElectionGuard service", e);
        }
    }

    /**
     * Get safe election information for chatbot responses
     * Only returns non-sensitive public information
     */
    public String getPublicElectionInfo(String query) {
        try {
            // Check if user is asking for the most recent election
            String lowerQuery = query.toLowerCase();
            if (lowerQuery.contains("recent") || lowerQuery.contains("latest") ||
                    lowerQuery.contains("most recent") || lowerQuery.contains("newest")) {
                return getMostRecentElectionInfo();
            }

            // Only get public completed elections to ensure privacy - limit to top 5 most
            // recent
            List<Election> publicElections = electionRepository.findMostRecentPublicCompletedElection(
                    org.springframework.data.domain.PageRequest.of(0, 5));

            if (publicElections.isEmpty()) {
                return "No completed public elections found with results available.";
            }

            StringBuilder result = new StringBuilder();
            result.append("📊 **Recent Public Election Results (Top 5)**\n\n");

            for (Election election : publicElections) {
                result.append("🗳️ **").append(election.getElectionTitle()).append("**\n");
                if (election.getElectionDescription() != null && !election.getElectionDescription().isEmpty()) {
                    result.append("Description: ").append(election.getElectionDescription()).append("\n");
                }

                // Get election choices (candidates/options) with vote counts
                List<ElectionChoice> choices = electionChoiceRepository
                        .findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
                // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));

                if (!choices.isEmpty()) {
                    // Sort by vote count (descending)
                    choices.sort((a, b) -> Integer.compare(b.getTotalVotes(), a.getTotalVotes()));

                    int totalVotes = choices.stream().mapToInt(ElectionChoice::getTotalVotes).sum();

                    result.append("**Results:**\n");
                    for (int i = 0; i < choices.size(); i++) {
                        ElectionChoice choice = choices.get(i);
                        result.append((i + 1)).append(". ").append(choice.getOptionTitle());
                        if (choice.getPartyName() != null && !choice.getPartyName().isEmpty()) {
                            result.append(" (").append(choice.getPartyName()).append(")");
                        }
                        result.append(": **").append(choice.getTotalVotes()).append(" votes**");

                        if (totalVotes > 0) {
                            double percentage = (choice.getTotalVotes() * 100.0) / totalVotes;
                            result.append(" (").append(String.format("%.1f", percentage)).append("%)");

                            // Mark the winner
                            if (i == 0 && choice.getTotalVotes() > 0) {
                                result.append(" 🏆 **WINNER**");
                            }
                        }
                        result.append("\n");
                    }

                    if (totalVotes > 0) {
                        result.append("Total Votes: ").append(totalVotes).append("\n");
                    }
                }
                result.append("\n");
            }

            return result.toString();

        } catch (Exception e) {
            return "Sorry, I'm having trouble accessing election information right now.";
        }
    }

    /**
     * Get information about the most recent public election with validation
     */
    private String getMostRecentElectionInfo() {
        try {
            List<Election> recentElections = electionRepository.findMostRecentPublicCompletedElection(
                    org.springframework.data.domain.PageRequest.of(0, 1));

            if (recentElections.isEmpty()) {
                return "No completed public elections found with results available.";
            }

            Election election = recentElections.get(0);

            // Validate election completeness by comparing vote counts with ballot counts
            if (!isElectionComplete(election)) {
                return "The most recent election is still being tallied. Results will be available once all votes are processed.";
            }

            StringBuilder result = new StringBuilder();

            result.append("🗳️ **Most Recent Public Election:**\n\n");
            result.append("**").append(election.getElectionTitle()).append("**\n");

            if (election.getElectionDescription() != null && !election.getElectionDescription().isEmpty()) {
                result.append("Description: ").append(election.getElectionDescription()).append("\n");
            }

            // Get election choices (candidates/options) with vote counts
            List<ElectionChoice> choices = electionChoiceRepository
                    .findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            if (!choices.isEmpty()) {
                result.append("\n**Results:**\n");

                // Sort by vote count (descending) to show winner first
                choices.sort((a, b) -> Integer.compare(b.getTotalVotes(), a.getTotalVotes()));

                int totalVotes = choices.stream().mapToInt(ElectionChoice::getTotalVotes).sum();

                for (int i = 0; i < choices.size(); i++) {
                    ElectionChoice choice = choices.get(i);
                    result.append((i + 1)).append(". ").append(choice.getOptionTitle());
                    if (choice.getPartyName() != null && !choice.getPartyName().isEmpty()) {
                        result.append(" (").append(choice.getPartyName()).append(")");
                    }
                    result.append(": **").append(choice.getTotalVotes()).append(" votes**");

                    if (totalVotes > 0) {
                        double percentage = (choice.getTotalVotes() * 100.0) / totalVotes;
                        result.append(" (").append(String.format("%.1f", percentage)).append("%)");

                        // Mark the winner
                        if (i == 0 && choice.getTotalVotes() > 0) {
                            result.append(" 🏆 **WINNER**");
                        }
                    }
                    result.append("\n");
                }

                if (totalVotes > 0) {
                    result.append("Total Votes: ").append(totalVotes).append("\n");
                }

                // Add winner summary
                if (!choices.isEmpty() && choices.get(0).getTotalVotes() > 0) {
                    ElectionChoice winner = choices.get(0);
                    result.append("\n🎉 **").append(winner.getOptionTitle()).append("**");
                    if (winner.getPartyName() != null && !winner.getPartyName().isEmpty()) {
                        result.append(" (").append(winner.getPartyName()).append(")");
                    }
                    result.append(" won the election!");

                    if (totalVotes > 0) {
                        double winnerPercentage = (winner.getTotalVotes() * 100.0) / totalVotes;
                        result.append(" They received ").append(winner.getTotalVotes())
                                .append(" votes (").append(String.format("%.1f", winnerPercentage))
                                .append("% of total votes).");
                    }
                }
            }

            return result.toString();

        } catch (Exception e) {
            return "Sorry, I'm having trouble accessing the most recent election information right now.";
        }
    }

    /**
     * Check if an election is complete by validating that total votes equals ballot
     * count
     */
    private boolean isElectionComplete(Election election) {
        try {
            // Get total votes from election choices
            List<ElectionChoice> choices = electionChoiceRepository
                    .findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
            // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
            int totalVotes = choices.stream().mapToInt(ElectionChoice::getTotalVotes).sum();

            // Get ballot count for the election
            long ballotCount = ballotRepository.countByElectionId(election.getElectionId());

            // Election is complete if total votes equals ballot count
            // Also require that election status is 'decrypted' for public results
            return totalVotes == ballotCount && "decrypted".equals(election.getStatus());

        } catch (Exception e) {
            // If we can't validate, assume incomplete to be safe
            return false;
        }
    }

    /**
     * Search for specific election by title or partial match
     */
    public String getSpecificElectionInfo(String electionQuery) {
        try {
            // If query is "all" or similar, just return all elections
            String lowerQuery = electionQuery.toLowerCase().trim();
            if (lowerQuery.equals("all") || lowerQuery.equals("all elections") ||
                    lowerQuery.equals("elections") || lowerQuery.isEmpty()) {
                return getPublicElectionInfo("");
            }

            // Only search in public completed elections
            List<Election> matchingElections = electionRepository.findPublicCompletedElections().stream()
                    .filter(e -> e.getElectionTitle().toLowerCase().contains(lowerQuery))
                    .collect(Collectors.toList());

            if (matchingElections.isEmpty()) {
                return "No public elections found with the title containing '" + electionQuery
                        + "'. Please check the election name and try again.";
            }

            StringBuilder result = new StringBuilder();
            result.append("🔍 **Search Results for '").append(electionQuery).append("'**\n\n");

            for (Election election : matchingElections) {
                result.append("🗳️ **").append(election.getElectionTitle()).append("**\n");
                if (election.getElectionDescription() != null && !election.getElectionDescription().isEmpty()) {
                    result.append("Description: ").append(election.getElectionDescription()).append("\n");
                }

                // Get detailed results
                List<ElectionChoice> choices = electionChoiceRepository
                        .findByElectionIdOrderByChoiceIdAsc(election.getElectionId());
                // choices.sort(Comparator.comparing(ElectionChoice::getChoiceId));
                if (!choices.isEmpty()) {
                    // Sort by vote count (descending)
                    choices.sort((a, b) -> Integer.compare(b.getTotalVotes(), a.getTotalVotes()));

                    int totalVotes = choices.stream().mapToInt(ElectionChoice::getTotalVotes).sum();

                    result.append("**Final Results:**\n");
                    for (int i = 0; i < choices.size(); i++) {
                        ElectionChoice choice = choices.get(i);
                        result.append((i + 1)).append(". ").append(choice.getOptionTitle());
                        if (choice.getPartyName() != null && !choice.getPartyName().isEmpty()) {
                            result.append(" (").append(choice.getPartyName()).append(")");
                        }
                        result.append(": **").append(choice.getTotalVotes()).append(" votes**");
                        if (totalVotes > 0) {
                            double percentage = (choice.getTotalVotes() * 100.0) / totalVotes;
                            result.append(" (").append(String.format("%.1f", percentage)).append("%)");

                            // Mark the winner
                            if (i == 0 && choice.getTotalVotes() > 0) {
                                result.append(" 🏆 **WINNER**");
                            }
                        }
                        result.append("\n");
                    }

                    if (totalVotes > 0) {
                        result.append("Total Votes: ").append(totalVotes).append("\n");
                    }
                }
                result.append("\n");
            }

            return result.toString();

        } catch (Exception e) {
            return "Sorry, I'm having trouble accessing election information right now.";
        }
    }

    /**
     * Get election start time information for a specific election
     */
    public String getElectionStartTimeInfo(String electionName) {
        try {
            // Find election by title (case-insensitive search)
            List<Election> elections = electionRepository.findAll();
            Election targetElection = null;

            for (Election election : elections) {
                if (election.getElectionTitle().toLowerCase().contains(electionName.toLowerCase())) {
                    // Check if it's public (privacy = "public")
                    if ("public".equalsIgnoreCase(election.getPrivacy())) {
                        targetElection = election;
                        break;
                    }
                }
            }

            if (targetElection == null) {
                return "Election '" + electionName + "' not found or not accessible. " +
                        "Please check the election name or ensure it's a public election.";
            }

            StringBuilder result = new StringBuilder();
            result.append("📅 **Election Schedule: ").append(targetElection.getElectionTitle()).append("**\n\n");

            if (targetElection.getElectionDescription() != null && !targetElection.getElectionDescription().isEmpty()) {
                result.append("**Description:** ").append(targetElection.getElectionDescription()).append("\n\n");
            }

            // Format start and end times
            if (targetElection.getStartingTime() != null) {
                result.append("⏰ **Start Time:** ").append(targetElection.getStartingTime().toString()).append("\n");
            } else {
                result.append("⏰ **Start Time:** Not specified\n");
            }

            if (targetElection.getEndingTime() != null) {
                result.append("⏰ **End Time:** ").append(targetElection.getEndingTime().toString()).append("\n");
            } else {
                result.append("⏰ **End Time:** Not specified\n");
            }

            // Add status information
            java.time.Instant now = java.time.Instant.now();
            if (targetElection.getStartingTime() != null) {
                if (targetElection.getStartingTime().isAfter(now)) {
                    result.append("\n🔔 **Status:** Election has not started yet\n");
                } else if (targetElection.getEndingTime() != null && targetElection.getEndingTime().isBefore(now)) {
                    result.append("\n✅ **Status:** Election has ended\n");
                } else {
                    result.append("\n🗳️ **Status:** Election is currently active\n");
                }
            }

            return result.toString();

        } catch (Exception e) {
            return "Sorry, I'm having trouble accessing election schedule information right now.";
        }
    }

    /**
     * Get guardian information for verification tab, excluding sensitive credentials
     * Includes decryption data from ALL chunks
     */
    public List<Map<String, Object>> getGuardiansForVerification(Long electionId) {
        try {
            List<Guardian> guardians = guardianRepository.findByElectionId(electionId);
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            
            return guardians.stream().map(guardian -> {
                Map<String, Object> guardianData = new HashMap<>();
                guardianData.put("id", guardian.getGuardianId());
                guardianData.put("electionId", guardian.getElectionId());
                guardianData.put("userEmail", guardian.getUserEmail());
                guardianData.put("sequenceOrder", guardian.getSequenceOrder());
                guardianData.put("guardianPublicKey", guardian.getGuardianPublicKey());
                guardianData.put("decryptedOrNot", guardian.getDecryptedOrNot());
                guardianData.put("keyBackup", guardian.getKeyBackup()); // From guardians table
                
                // Get decryption data from ALL chunks for this guardian
                List<Map<String, Object>> chunkDecryptions = new ArrayList<>();
                for (ElectionCenter center : electionCenters) {
                    // Find decryption for this guardian and this chunk
                    List<Decryption> decryptions = decryptionRepository.findByElectionCenterIdAndGuardianId(
                        center.getElectionCenterId(), 
                        guardian.getGuardianId()
                    );
                    
                    if (!decryptions.isEmpty()) {
                        Decryption decryption = decryptions.get(0); // Should be only one per guardian per chunk
                        Map<String, Object> chunkData = new HashMap<>();
                        chunkData.put("electionCenterId", center.getElectionCenterId());
                        chunkData.put("chunkIndex", center.getElectionCenterId()); // Use center ID as chunk identifier
                        chunkData.put("partialDecryptedTally", decryption.getPartialDecryptedTally());
                        chunkData.put("guardianDecryptionKey", decryption.getGuardianDecryptionKey());
                        chunkData.put("tallyShare", decryption.getTallyShare());
                        chunkData.put("datePerformed", decryption.getDatePerformed());
                        chunkDecryptions.add(chunkData);
                    }
                }
                
                guardianData.put("chunkDecryptions", chunkDecryptions);
                // Intentionally exclude sensitive credentials field
                
                return guardianData;
            }).collect(Collectors.toList());
            
        } catch (Exception e) {
            System.err.println("Error retrieving guardians for verification: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to retrieve guardian information", e);
        }
    }

    /**
     * Get compensated decryption information for verification tab
     */
    public List<Map<String, Object>> getCompensatedDecryptionsForVerification(Long electionId) {
        try {
            System.out.println("Fetching compensated decryptions for election: " + electionId);
            
            // Get all election centers (chunks) for this election
            List<ElectionCenter> centers = electionCenterRepository.findByElectionId(electionId);
            System.out.println("Found " + centers.size() + " chunks for election " + electionId);
            
            // Map to track unique guardian pairs and aggregate their data
            Map<String, Map<String, Object>> uniqueCompensations = new HashMap<>();
            
            for (ElectionCenter center : centers) {
                List<CompensatedDecryption> compensatedDecryptions = 
                    compensatedDecryptionRepository.findByElectionCenterId(center.getElectionCenterId());
                
                System.out.println("Found " + compensatedDecryptions.size() + " compensated decryptions for chunk " + center.getElectionCenterId());
                
                for (CompensatedDecryption cd : compensatedDecryptions) {
                    // Create unique key for this guardian pair
                    String pairKey = cd.getCompensatingGuardianId() + "-" + cd.getMissingGuardianId();
                    
                    // If this guardian pair hasn't been seen yet, add it
                    if (!uniqueCompensations.containsKey(pairKey)) {
                        Map<String, Object> cdData = new HashMap<>();
                        cdData.put("compensatedDecryptionId", cd.getCompensatedDecryptionId());
                        cdData.put("electionCenterId", cd.getElectionCenterId());
                        cdData.put("compensatingGuardianId", cd.getCompensatingGuardianId());
                        cdData.put("missingGuardianId", cd.getMissingGuardianId());
                        cdData.put("compensatedTallyShare", cd.getCompensatedTallyShare());
                        cdData.put("compensatedBallotShare", cd.getCompensatedBallotShare());
                        cdData.put("chunkCount", 1); // Track how many chunks this pair appears in
                        
                        // Look up guardian info
                        Optional<Guardian> compensatingGuardian = guardianRepository.findById(cd.getCompensatingGuardianId());
                        Optional<Guardian> missingGuardian = guardianRepository.findById(cd.getMissingGuardianId());
                        
                        if (compensatingGuardian.isPresent()) {
                            cdData.put("compensatingGuardianEmail", compensatingGuardian.get().getUserEmail());
                            cdData.put("compensatingGuardianSequence", compensatingGuardian.get().getSequenceOrder());
                            cdData.put("compensatingGuardianName", "Guardian " + compensatingGuardian.get().getSequenceOrder());
                        }
                        
                        if (missingGuardian.isPresent()) {
                            cdData.put("missingGuardianEmail", missingGuardian.get().getUserEmail());
                            cdData.put("missingGuardianSequence", missingGuardian.get().getSequenceOrder());
                            cdData.put("missingGuardianName", "Guardian " + missingGuardian.get().getSequenceOrder());
                        }
                        
                        uniqueCompensations.put(pairKey, cdData);
                    } else {
                        // Guardian pair already exists, just increment chunk count
                        Map<String, Object> existingData = uniqueCompensations.get(pairKey);
                        int currentCount = (int) existingData.get("chunkCount");
                        existingData.put("chunkCount", currentCount + 1);
                    }
                }
            }
            
            List<Map<String, Object>> result = new ArrayList<>(uniqueCompensations.values());
            System.out.println("Returning " + result.size() + " unique compensated decryption pairs (aggregated across " + centers.size() + " chunks)");
            return result;
        } catch (Exception e) {
            System.err.println("Error retrieving compensated decryptions for verification: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to retrieve compensated decryption information", e);
        }
    }

    /**
     * Get election results with chunk information
     * Returns individual chunk results and combined final results
     */
    public ElectionResultsResponse getElectionResults(Long electionId, String userEmail) {
        try {
            System.out.println("Fetching election results for ID: " + electionId + " by user: " + userEmail);
            
            // Check if election exists and user is authorized
            Optional<Election> electionOpt = electionRepository.findById(electionId);
            if (!electionOpt.isPresent()) {
                return ElectionResultsResponse.builder()
                    .success(false)
                    .message("Election not found")
                    .build();
            }
            
            Election election = electionOpt.get();
            
            // Check authorization
            if (!isUserAuthorizedToViewElection(election, userEmail)) {
                return ElectionResultsResponse.builder()
                    .success(false)
                    .message("You are not authorized to view this election")
                    .build();
            }
            
            // Get all election centers (chunks) for this election
            List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(electionId);
            
            if (electionCenters.isEmpty()) {
                return ElectionResultsResponse.builder()
                    .success(false)
                    .message("No tally data found for this election")
                    .build();
            }
            
            // Parse results from each chunk
            List<ChunkResultResponse> chunkResults = new ArrayList<>();
            Map<String, Integer> finalResults = new HashMap<>();
            List<ElectionResultsResponse.BallotInfo> allBallots = new ArrayList<>();
            int chunkNumber = 1;
            
            for (ElectionCenter center : electionCenters) {
                String electionResult = center.getElectionResult();
                
                if (electionResult != null && !electionResult.trim().isEmpty()) {
                    try {
                        // Parse the election result JSON
                        @SuppressWarnings("unchecked")
                        Map<String, Object> resultMap = objectMapper.readValue(electionResult, Map.class);
                        
                        // Extract candidate votes from this chunk
                        Map<String, Integer> chunkVotes = new HashMap<>();
                        List<String> trackingCodes = new ArrayList<>();
                        List<String> ballotHashes = new ArrayList<>();
                        
                        // Parse results structure
                        if (resultMap.containsKey("results")) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> results = (Map<String, Object>) resultMap.get("results");
                            if (results.containsKey("candidates")) {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> candidates = (Map<String, Object>) results.get("candidates");
                                for (Map.Entry<String, Object> entry : candidates.entrySet()) {
                                    String candidateName = entry.getKey();
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> candidateData = (Map<String, Object>) entry.getValue();
                                    Object votesObj = candidateData.get("votes");
                                    int votes = (votesObj instanceof Integer) ? (Integer) votesObj : 
                                               Integer.parseInt(String.valueOf(votesObj));
                                    
                                    chunkVotes.put(candidateName, votes);
                                    finalResults.put(candidateName, 
                                        finalResults.getOrDefault(candidateName, 0) + votes);
                                }
                            }
                        }
                        
                        // Extract ballot tracking codes and hashes
                        if (resultMap.containsKey("ballots")) {
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> ballots = (List<Map<String, Object>>) resultMap.get("ballots");
                            for (Map<String, Object> ballot : ballots) {
                                String trackingCode = (String) ballot.get("tracking_code");
                                String ballotHash = (String) ballot.get("ballot_hash");
                                trackingCodes.add(trackingCode);
                                ballotHashes.add(ballotHash);
                                
                                allBallots.add(ElectionResultsResponse.BallotInfo.builder()
                                    .trackingCode(trackingCode)
                                    .ballotHash(ballotHash)
                                    .chunkNumber(chunkNumber)
                                    .build());
                            }
                        }
                        
                        chunkResults.add(ChunkResultResponse.builder()
                            .electionCenterId(center.getElectionCenterId())
                            .chunkNumber(chunkNumber)
                            .candidateVotes(chunkVotes)
                            .trackingCodes(trackingCodes)
                            .ballotHashes(ballotHashes)
                            .build());
                        
                    } catch (Exception e) {
                        System.err.println("Error parsing chunk " + chunkNumber + " results: " + e.getMessage());
                    }
                }
                chunkNumber++;
            }
            
            // Calculate total votes
            int totalVotes = finalResults.values().stream().mapToInt(Integer::intValue).sum();
            
            return ElectionResultsResponse.builder()
                .success(true)
                .message("Results retrieved successfully")
                .electionId(electionId)
                .electionTitle(election.getElectionTitle())
                .status(election.getStatus())
                .chunkResults(chunkResults)
                .finalResults(finalResults)
                .totalVotes(totalVotes)
                .ballots(allBallots)
                .build();
                
        } catch (Exception e) {
            System.err.println("Error getting election results: " + e.getMessage());
            e.printStackTrace();
            return ElectionResultsResponse.builder()
                .success(false)
                .message("Internal server error: " + e.getMessage())
                .build();
        }
    }

    // -----------------------------------------------------------------------
    // Internal helpers for deserialization of microservice list responses
    // -----------------------------------------------------------------------

    /**
     * Serializes each Object element (dict or primitive) to a JSON string.
     * Used for guardian_data which must be stored as a JSON blob.
     */
    private List<String> toJsonStringList(List<Object> objects) {
        if (objects == null) return null;
        List<String> result = new ArrayList<>();
        for (Object obj : objects) {
            try {
                result.add(obj instanceof String s ? s : objectMapper.writeValueAsString(obj));
            } catch (Exception e) {
                result.add(obj != null ? obj.toString() : null);
            }
        }
        return result;
    }
}
