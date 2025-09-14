package com.amarvote.amarvote.controller;

// ElectionController.java

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
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
import com.amarvote.amarvote.dto.CreateEncryptedBallotRequest;
import com.amarvote.amarvote.dto.CreateEncryptedBallotResponse;
import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionDetailResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.dto.EligibilityCheckRequest;
import com.amarvote.amarvote.dto.EligibilityCheckResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.service.BallotService;
import com.amarvote.amarvote.service.BlockchainService;
import com.amarvote.amarvote.service.CloudinaryService;
import com.amarvote.amarvote.service.ElectionService;
import com.amarvote.amarvote.service.PartialDecryptionService;
import com.amarvote.amarvote.service.TallyService;

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

    @PostMapping(value = "/create-encrypted-ballot", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreateEncryptedBallotResponse> createEncryptedBallot(
            @Valid @RequestBody CreateEncryptedBallotRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Creating encrypted ballot for election ID: " + request.getElectionId() + " by user: " + userEmail);

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
            CreateEncryptedBallotResponse response = ballotService.createEncryptedBallot(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
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
            CreateTallyResponse response = tallyService.createTally(request, userEmail);

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
}