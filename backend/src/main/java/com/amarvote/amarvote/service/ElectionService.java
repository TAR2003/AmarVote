package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient; // Fixed: Use Spring's HttpHeaders, not Netty's

import com.amarvote.amarvote.dto.ElectionCreationRequest; // Added: For setting content type
import com.amarvote.amarvote.dto.ElectionDetailResponse; // Added: For handling HTTP responses
import com.amarvote.amarvote.dto.ElectionGuardianSetupRequest;
import com.amarvote.amarvote.dto.ElectionGuardianSetupResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.dto.OptimizedElectionResponse;
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.User;
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
        election.setPrivacy(request.electionPrivacy()); // Set privacy field
        election.setEligibility(request.electionEligibility()); // Set eligibility field

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

        // Only save voters for "listed" eligibility elections
        List<String> voterEmails = request.voterEmails();
        if ("listed".equals(request.electionEligibility()) && voterEmails != null && !voterEmails.isEmpty()) {
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
            System.out.println("Allowed voters saved successfully for listed election.");
        } else {
            System.out.println("No voters saved - election eligibility is 'unlisted' or no voter emails provided.");
        }

        return election;
    }

    /**
     * Get all elections that are accessible to a specific user
     * This includes:
     * 1. All elections where the user is in the allowed voters list
     * 2. All elections where the user is the admin (admin_email matches)
     * 3. All elections where the user is a guardian
     * 
     * Optimized implementation to retrieve all required election data in a single query
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
     * we use a more optimized approach with batch fetching to avoid N+1 query problems.
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
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionIdAndUserEmail(election.getElectionId(), userEmail);
        if (!allowedVoters.isEmpty()) {
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
        boolean hasVoted = false;
        Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
        if (userOpt.isPresent()) {
            List<AllowedVoter> allAllowedVoters = allowedVoterRepository.findByElectionId(election.getElectionId());
            hasVoted = allAllowedVoters.stream()
                .anyMatch(av -> av.getUserId().equals(userOpt.get().getUserId()) && av.getHasVoted());
        }
        
        // Get admin name
        String adminName = null;
        if (election.getAdminEmail() != null) {
            Optional<User> adminUser = userRepository.findByUserEmail(election.getAdminEmail());
            if (adminUser.isPresent()) {
                adminName = adminUser.get().getUserName();
            }
        }
        
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
     * @param userEmail The email of the user requesting the election
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
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionIdAndUserEmail(election.getElectionId(), userEmail);
        if (!allowedVoters.isEmpty()) {
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
        List<ElectionDetailResponse.GuardianInfo> guardians = getGuardianInfoForElection(election.getElectionId(), userEmail);
        
        // Calculate guardian progress
        int totalGuardians = guardians.size();
        int guardiansSubmitted = (int) guardians.stream()
                .filter(guardian -> guardian.getDecryptedOrNot() != null && guardian.getDecryptedOrNot())
                .count();
        boolean allGuardiansSubmitted = totalGuardians > 0 && guardiansSubmitted == totalGuardians;
        
        // Get voters with user details
        List<ElectionDetailResponse.VoterInfo> voters = getVoterInfoForElection(election.getElectionId(), userEmail);
        
        // Get election choices
        List<ElectionDetailResponse.ElectionChoiceInfo> electionChoices = getElectionChoicesForElection(election.getElectionId());
        
        // Get admin name
        String adminName = null;
        if (election.getAdminEmail() != null) {
            Optional<User> adminUser = userRepository.findByUserEmail(election.getAdminEmail());
            if (adminUser.isPresent()) {
                adminName = adminUser.get().getUserName();
            }
        }
        
        return ElectionDetailResponse.builder()
                .electionId(election.getElectionId())
                .electionTitle(election.getElectionTitle())
                .electionDescription(election.getElectionDescription())
                .numberOfGuardians(election.getNumberOfGuardians())
                .electionQuorum(election.getElectionQuorum())
                .noOfCandidates(election.getNoOfCandidates())
                .jointPublicKey(election.getJointPublicKey())
                .manifestHash(election.getManifestHash())
                .status(election.getStatus())
                .startingTime(election.getStartingTime())
                .endingTime(election.getEndingTime())
                .encryptedTally(election.getEncryptedTally())
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
        List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionIdAndUserEmail(election.getElectionId(), userEmail);
        if (!allowedVoters.isEmpty()) {
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
    private List<ElectionDetailResponse.GuardianInfo> getGuardianInfoForElection(Long electionId, String currentUserEmail) {
        List<Object[]> guardianData = guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId);
        
        return guardianData.stream()
                .map(data -> {
                    Guardian guardian = (Guardian) data[0];
                    User user = (User) data[1];
                    
                    // Calculate decryption status based on tallyShare field
                    boolean hasDecrypted = guardian.getTallyShare() != null && !guardian.getTallyShare().trim().isEmpty();
                    
                    return ElectionDetailResponse.GuardianInfo.builder()
                            .userEmail(user.getUserEmail())
                            .userName(user.getUserName())
                            .guardianPublicKey(guardian.getGuardianPublicKey())
                            .guardianPolynomial(guardian.getGuardianPolynomial())
                            .sequenceOrder(guardian.getSequenceOrder())
                            .decryptedOrNot(hasDecrypted)
                            .partialDecryptedTally(guardian.getPartialDecryptedTally())
                            .proof(guardian.getProof())
                            .isCurrentUser(user.getUserEmail().equals(currentUserEmail))
                            .build();
                })
                .collect(Collectors.toList());
    }
    
    /**
     * Get voter information for an election
     */
    private List<ElectionDetailResponse.VoterInfo> getVoterInfoForElection(Long electionId, String currentUserEmail) {
        List<Object[]> voterData = allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId);
        
        return voterData.stream()
                .map(data -> {
                    AllowedVoter allowedVoter = (AllowedVoter) data[0];
                    User user = (User) data[1];
                    
                    return ElectionDetailResponse.VoterInfo.builder()
                            .userEmail(user.getUserEmail())
                            .userName(user.getUserName())
                            .hasVoted(allowedVoter.getHasVoted())
                            .isCurrentUser(user.getUserEmail().equals(currentUserEmail))
                            .build();
                })
                .collect(Collectors.toList());
    }
    
    /**
     * Get election choices for an election
     */
    private List<ElectionDetailResponse.ElectionChoiceInfo> getElectionChoicesForElection(Long electionId) {
        List<ElectionChoice> choices = electionChoiceRepository.findByElectionId(electionId);
        
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
