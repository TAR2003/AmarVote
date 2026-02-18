package com.amarvote.amarvote.controller;

// ElectionController.java

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.amarvote.amarvote.dto.BenalohChallengeRequest;
import com.amarvote.amarvote.dto.BenalohChallengeResponse;
import com.amarvote.amarvote.dto.BlockchainBallotInfoResponse;
import com.amarvote.amarvote.dto.BlockchainLogsResponse;
import com.amarvote.amarvote.dto.CastBallotRequest;
import com.amarvote.amarvote.dto.CastBallotResponse;
import com.amarvote.amarvote.dto.CastEncryptedBallotRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CombineStatusResponse;
import com.amarvote.amarvote.dto.CreateEncryptedBallotRequest;
import com.amarvote.amarvote.dto.CreateEncryptedBallotResponse;
import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionDetailResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.dto.ElectionResultsResponse;
import com.amarvote.amarvote.dto.EligibilityCheckRequest;
import com.amarvote.amarvote.dto.EligibilityCheckResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.service.BallotService;
import com.amarvote.amarvote.service.BlockchainService;
import com.amarvote.amarvote.service.CloudinaryService;
import com.amarvote.amarvote.service.ElectionService;
import com.amarvote.amarvote.service.PartialDecryptionService;
import com.amarvote.amarvote.service.TallyService;
import com.amarvote.amarvote.util.BallotPaddingUtil;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ElectionController {
    private final ElectionService electionService;
    private final BallotService ballotService;
    private final TallyService tallyService;
    private final PartialDecryptionService partialDecryptionService;
    private final BlockchainService blockchainService;
    private final CloudinaryService cloudinaryService;
    private final ObjectMapper objectMapper;

    @PostMapping("/create-election")
    public ResponseEntity<Election> createElection(
            @Valid @RequestBody ElectionCreationRequest request,
            HttpServletRequest httpRequest) {

        // Get JWT token and user email from request attributes (set by JWTFilter)
        String jwtToken = (String) httpRequest.getAttribute("jwtToken");
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        System.out.println("Creating election with JWT: " + jwtToken);
        System.out.println("User email: " + userEmail);

        Election election = electionService.createElection(request, jwtToken, userEmail);

        if (election == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(election);
    }

    /**
     * Get all elections accessible to the current user
     * This endpoint is optimized to fetch all required data in a single query
     * to avoid N+1 query problems when dealing with hundreds of elections.
     */
    @GetMapping("/all-elections")
    public ResponseEntity<List<ElectionResponse>> getAllElections(HttpServletRequest httpRequest) {
        try {
            // Get user email from request attributes (set by JWTFilter)
            String userEmail = (String) httpRequest.getAttribute("userEmail");

            // Alternative: Get user email from Spring Security context
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            System.out.println("API: Fetching optimized accessible elections for user: " + userEmail);

            // Get all elections accessible to the user using the optimized method
            List<ElectionResponse> accessibleElections = electionService.getAllAccessibleElections(userEmail);

            System.out.println("API: Found " + accessibleElections.size()
                    + " accessible elections - data includes all fields required by frontend");

            return ResponseEntity.ok(accessibleElections);

        } catch (Exception e) {
            System.err.println("Error fetching elections: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/election/{id}")
    public ResponseEntity<ElectionDetailResponse> getElectionById(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        try {
            // Get user email from request attributes (set by JWTFilter)
            String userEmail = (String) httpRequest.getAttribute("userEmail");

            // Alternative: Get user email from Spring Security context
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            System.out.println("Fetching election details for ID: " + id + " by user: " + userEmail);

            // Get election details if user is authorized
            ElectionDetailResponse electionDetails = electionService.getElectionById(id, userEmail);

            if (electionDetails == null) {
                // User is not authorized to view this election or election doesn't exist
                return ResponseEntity.ok(null);
            }

            System.out.println("Successfully retrieved election details for ID: " + id);
            return ResponseEntity.ok(electionDetails);

        } catch (Exception e) {
            System.err.println("Error fetching election details: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping(value = "/cast-ballot", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CastBallotResponse> castBallot(
            @Valid @RequestBody CastBallotRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Casting ballot for election ID: " + request.getElectionId() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .errorReason("Unauthorized")
                            .build());
        }

        try {
            CastBallotResponse response = ballotService.castBallot(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .errorReason("Server error: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping(value = "/create-encrypted-ballot", 
                 consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE,
                 produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CreateEncryptedBallotResponse> createEncryptedBallot(
            @RequestBody byte[] paddedData,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        
        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            // Log received payload size for security monitoring
            System.out.println("🔒 [SECURE BALLOT] Received fixed-size payload: " + paddedData.length + " bytes");
            
            // Validate payload size matches expected constant size
            if (!BallotPaddingUtil.validateSize(paddedData, BallotPaddingUtil.TARGET_SIZE)) {
                System.out.println("⚠️ [SECURE BALLOT] WARNING: Payload size mismatch - potential security issue");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(CreateEncryptedBallotResponse.builder()
                                .success(false)
                                .message("Invalid payload size")
                                .build());
            }

            // Log padding statistics for monitoring
            System.out.println("📊 [SECURE BALLOT] " + BallotPaddingUtil.getPaddingStats(paddedData));

            // Remove PKCS#7 padding to extract original JSON payload
            String jsonPayload = BallotPaddingUtil.parseJsonFromPaddedData(paddedData);
            
            System.out.println("✅ [SECURE BALLOT] Successfully extracted ballot data");

            // Parse JSON to CreateEncryptedBallotRequest
            CreateEncryptedBallotRequest request = objectMapper.readValue(jsonPayload, CreateEncryptedBallotRequest.class);
            
            System.out.println("Creating encrypted ballot for election ID: " + request.getElectionId() + " by user: " + userEmail);

            // Process the ballot request
            CreateEncryptedBallotResponse response = ballotService.createEncryptedBallot(request, userEmail);

            if (response.isSuccess()) {
                System.out.println("✅ [SECURE BALLOT] Ballot created successfully");
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (IllegalArgumentException e) {
            // Padding validation errors
            System.out.println("❌ [SECURE BALLOT] Padding validation failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("Invalid request format: " + e.getMessage())
                            .build());
        } catch (Exception e) {
            System.out.println("❌ [SECURE BALLOT] Internal error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .build());
        }
    }

    @PostMapping(value = "/benaloh-challenge", consumes = "application/json", produces = "application/json")
    public ResponseEntity<BenalohChallengeResponse> performBenalohChallenge(
            @Valid @RequestBody BenalohChallengeRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Performing Benaloh challenge for election ID: " + request.getElectionId() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(BenalohChallengeResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            BenalohChallengeResponse response = ballotService.performBenalohChallenge(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(BenalohChallengeResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .build());
        }
    }

    @PostMapping(value = "/cast-encrypted-ballot", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CastBallotResponse> castEncryptedBallot(
            @Valid @RequestBody CastEncryptedBallotRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Casting encrypted ballot for election ID: " + request.getElectionId() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .errorReason("Unauthorized")
                            .build());
        }

        try {
            CastBallotResponse response = ballotService.castEncryptedBallot(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .errorReason("Server error: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping(value = "/eligibility", consumes = "application/json", produces = "application/json")
    public ResponseEntity<EligibilityCheckResponse> checkEligibility(
            @Valid @RequestBody EligibilityCheckRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out
                .println("Checking eligibility for election ID: " + request.getElectionId() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(EligibilityCheckResponse.builder()
                            .eligible(false)
                            .message("User authentication required")
                            .reason("Unauthorized")
                            .hasVoted(false)
                            .isElectionActive(false)
                            .electionStatus("N/A")
                            .build());
        }

        try {
            EligibilityCheckResponse response = ballotService.checkEligibility(request, userEmail);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(EligibilityCheckResponse.builder()
                            .eligible(false)
                            .message("Internal server error occurred")
                            .reason("Server error: " + e.getMessage())
                            .hasVoted(false)
                            .isElectionActive(false)
                            .electionStatus("Error")
                            .build());
        }
    }

    /**
     * Initiate tally creation (new endpoint with progress tracking)
     * Returns immediately after initiating async processing
     */
    @PostMapping(value = "/initiate-tally", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreateTallyResponse> initiateTallyCreation(
            @Valid @RequestBody CreateTallyRequest request,
            HttpServletRequest httpRequest) {
        
        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }
        
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }
        
        System.out.println("Initiating tally creation for election ID: " + request.getElection_id() + " by user: " + userEmail);
        
        try {
            CreateTallyResponse response = tallyService.initiateTallyCreation(request, userEmail);
            
            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error initiating tally creation: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get tally creation status for an election
     */
    @GetMapping("/election/{electionId}/tally-status")
    public ResponseEntity<?> getTallyStatus(@PathVariable Long electionId) {
        try {
            System.out.println("Fetching tally status for election ID: " + electionId);
            com.amarvote.amarvote.dto.TallyCreationStatusResponse status = tallyService.getTallyStatus(electionId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            System.err.println("Error fetching tally status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                        "success", false,
                        "message", "Failed to fetch tally status: " + e.getMessage()
                    ));
        }
    }

    @PostMapping(value = "/create-tally", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreateTallyResponse> createTally(
            @Valid @RequestBody CreateTallyRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Creating tally for election ID: " + request.getElection_id() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            // Delegate to new async system
            CreateTallyResponse response = tallyService.initiateTallyCreation(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping(value = "/create-partial-decryption", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreatePartialDecryptionResponse> createPartialDecryption(
            @Valid @RequestBody CreatePartialDecryptionRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println(
                "Creating partial decryption for election ID: " + request.election_id() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            CreatePartialDecryptionResponse response = partialDecryptionService.createPartialDecryption(request,
                    userEmail);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error creating partial decryption: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Initiate guardian decryption process (async, returns immediately)
     */
    @PostMapping(value = "/guardian/initiate-decryption", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreatePartialDecryptionResponse> initiateDecryption(
            @Valid @RequestBody CreatePartialDecryptionRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Initiating decryption for election ID: " + request.election_id() + " by user: " + userEmail);

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            CreatePartialDecryptionResponse response = partialDecryptionService.initiateDecryption(request, userEmail);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error initiating decryption: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get decryption status for the authenticated guardian
     */
    @GetMapping("/guardian/decryption-status/{electionId}")
    public ResponseEntity<?> getDecryptionStatus(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {

        // Get user email from Spring Security context
        String userEmail = null;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            userEmail = authentication.getName();
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "success", false,
                            "message", "User not authenticated"
                    ));
        }

        System.out.println("Getting decryption status for election: " + electionId + ", user: " + userEmail);

        try {
            com.amarvote.amarvote.dto.DecryptionStatusResponse response = 
                partialDecryptionService.getDecryptionStatusByEmail(electionId, userEmail);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error getting decryption status: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "success", false,
                            "message", "Failed to get decryption status: " + e.getMessage()
                    ));
        }
    }

    /**
     * Get decryption status by guardian ID (for timeline and admin views)
     */
    @GetMapping("/guardian/decryption-status/{electionId}/{guardianId}")
    public ResponseEntity<?> getDecryptionStatusByGuardianId(
            @PathVariable Long electionId,
            @PathVariable Long guardianId) {

        System.out.println("Getting decryption status for election: " + electionId + ", guardianId: " + guardianId);

        try {
            com.amarvote.amarvote.dto.DecryptionStatusResponse response = 
                partialDecryptionService.getDecryptionStatus(electionId, guardianId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error getting decryption status by guardian ID: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "success", false,
                            "message", "Failed to get decryption status: " + e.getMessage()));
        }
    }

    /**
     * Initiate async combine partial decryption process
     */
    @PostMapping(value = "/initiate-combine", produces = "application/json")
    public ResponseEntity<CombinePartialDecryptionResponse> initiateCombine(
            @RequestParam Long electionId) {

        System.out.println("Initiating combine for election ID: " + electionId);

        try {
            // Extract user email from authentication context
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String userEmail = null;
            
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
            
            if (userEmail == null || userEmail.equals("anonymousUser")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(CombinePartialDecryptionResponse.builder()
                                .success(false)
                                .message("User not authenticated")
                                .build());
            }
            
            CombinePartialDecryptionResponse response = partialDecryptionService.initiateCombine(electionId, userEmail);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error initiating combine: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get combine status for an election
     */
    @GetMapping("/combine-status/{electionId}")
    public ResponseEntity<?> getCombineStatus(@PathVariable Long electionId) {
        try {
            CombineStatusResponse status = partialDecryptionService.getCombineStatus(electionId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            System.err.println("Error getting combine status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false,
                            "message", "Failed to get combine status: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/combine-partial-decryption", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CombinePartialDecryptionResponse> combinePartialDecryption(
            @Valid @RequestBody CombinePartialDecryptionRequest request) {

        System.out.println("Combining partial decryption for election ID: " + request.election_id());

        try {
            CombinePartialDecryptionResponse response = partialDecryptionService.combinePartialDecryption(request);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error combining partial decryption: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get cached election results with chunk breakdown
     * Returns results from election_result field if already computed
     */
    @GetMapping("/election/{electionId}/cached-results")
    public ResponseEntity<?> getCachedElectionResults(@PathVariable Long electionId) {
        try {
            System.out.println("Fetching cached election results for ID: " + electionId);

            Object results = partialDecryptionService.getElectionResults(electionId);

            if (results == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Results not yet available"));
            }

            return ResponseEntity.ok(Map.of("success", true, "results", results));

        } catch (Exception e) {
            System.err.println("Error fetching cached election results: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Internal server error: " + e.getMessage()));
        }
    }

    /**
     * 🔗 Verify a ballot on the blockchain by election ID and tracking code
     * This endpoint is public and can be used by voters to verify their ballots
     */
    @GetMapping("/blockchain/ballot/{electionId}/{trackingCode}")
    public ResponseEntity<?> verifyBallotOnBlockchain(
            @PathVariable String electionId,
            @PathVariable String trackingCode) {

        try {
            System.out.println(
                    "🔍 Verifying ballot on blockchain - Election: " + electionId + ", Tracking: " + trackingCode);

            BlockchainBallotInfoResponse response = blockchainService.getBallotInfo(electionId, trackingCode);

            if (response.isSuccess()) {
                System.out.println("✅ Ballot verification successful for " + trackingCode);
                return ResponseEntity.ok(response);
            } else {
                System.out.println("❌ Ballot verification failed for " + trackingCode + ": " + response.getMessage());
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error during blockchain ballot verification: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "success", false,
                            "message", "Error verifying ballot on blockchain: " + e.getMessage(),
                            "exists", false));
        }
    }

    /**
     * 🔗 Get election logs from blockchain
     * This endpoint returns all blockchain logs for an election
     */
    @GetMapping("/blockchain/logs/{electionId}")
    public ResponseEntity<?> getElectionLogsFromBlockchain(@PathVariable String electionId) {

        try {
            System.out.println("📜 Retrieving blockchain logs for election: " + electionId);

            BlockchainLogsResponse response = blockchainService.getElectionLogs(electionId);

            if (response.isSuccess()) {
                System.out.println("✅ Successfully retrieved " +
                        " blockchain logs for election " + electionId);
                return ResponseEntity.ok(response);
            } else {
                System.out.println(
                        "❌ Failed to retrieve blockchain logs for " + electionId + ": " + response.getMessage());
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error retrieving blockchain logs: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "success", false,
                            "message", "Error retrieving blockchain logs: " + e.getMessage(),
                            "logs", List.of()));
        }
    }

    /**
     * Get ballot details including cipher text by election ID and tracking code
     */
    @GetMapping("/ballot-details/{electionId}/{trackingCode}")
    public ResponseEntity<?> getBallotDetails(
            @PathVariable Long electionId,
            @PathVariable String trackingCode) {

        try {
            System.out.println("🔍 Fetching ballot details - Election: " + electionId + ", Tracking: " + trackingCode);

            Map<String, Object> ballotDetails = ballotService.getBallotDetails(electionId, trackingCode);

            if (ballotDetails != null && !ballotDetails.isEmpty()) {
                System.out.println("✅ Ballot details retrieved for " + trackingCode);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "ballot", ballotDetails));
            } else {
                System.out.println("❌ Ballot not found for " + trackingCode);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "success", false,
                        "message", "Ballot not found for the provided tracking code"));
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error fetching ballot details: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "success", false,
                            "message", "Error fetching ballot details: " + e.getMessage()));
        }
    }

    @PostMapping("/upload-candidate-image")
    public ResponseEntity<?> uploadCandidateImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("candidateName") String candidateName) {
        
        try {
            System.out.println("Received candidate image upload request. File: " + file.getOriginalFilename() + 
                             ", Size: " + file.getSize() + ", Content-Type: " + file.getContentType() + 
                             ", Candidate: " + candidateName);
                             
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.CANDIDATE);
            
            System.out.println("Successfully uploaded candidate image to: " + imageUrl);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Candidate image uploaded successfully",
                "imageUrl", imageUrl
            ));
        } catch (Exception e) {
            System.err.println("Error uploading candidate image: " + e.getMessage());
            e.printStackTrace();
            
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Failed to upload candidate image: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/upload-party-image")
    public ResponseEntity<?> uploadPartyImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("partyName") String partyName) {
        
        try {
            System.out.println("Received party image upload request. File: " + file.getOriginalFilename() + 
                             ", Size: " + file.getSize() + ", Content-Type: " + file.getContentType() + 
                             ", Party: " + partyName);
                             
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.PARTY);
            
            System.out.println("Successfully uploaded party image to: " + imageUrl);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Party image uploaded successfully",
                "imageUrl", imageUrl
            ));
        } catch (Exception e) {
            System.err.println("Error uploading party image: " + e.getMessage());
            e.printStackTrace();
            
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Failed to upload party image: " + e.getMessage()
            ));
        }
    }

    /**
     * Get guardians information for verification tab
     * Excludes sensitive credentials field
     */
    @GetMapping("/election/{id}/guardians")
    public ResponseEntity<?> getElectionGuardians(@PathVariable Long id) {
        try {
            // Get guardians for this election excluding sensitive credentials
            List<Map<String, Object>> guardians = electionService.getGuardiansForVerification(id);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "guardians", guardians
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Failed to retrieve guardian information: " + e.getMessage()
            ));
        }
    }

    /**
     * Get compensated decryptions information for verification tab
     */
    @GetMapping("/election/{id}/compensated-decryptions")
    public ResponseEntity<?> getElectionCompensatedDecryptions(@PathVariable Long id) {
        try {
            // Get compensated decryptions for this election
            List<Map<String, Object>> compensatedDecryptions = electionService.getCompensatedDecryptionsForVerification(id);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "compensatedDecryptions", compensatedDecryptions
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Failed to retrieve compensated decryption information: " + e.getMessage()
            ));
        }
    }

    /**
     * Get election results with chunk information
     */
    @GetMapping("/election/{id}/results")
    public ResponseEntity<ElectionResultsResponse> getElectionResults(@PathVariable Long id) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userEmail = authentication.getName();
        
        ElectionResultsResponse results = electionService.getElectionResults(id, userEmail);
        
        if (results.isSuccess()) {
            return ResponseEntity.ok(results);
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(results);
        }
    }
}