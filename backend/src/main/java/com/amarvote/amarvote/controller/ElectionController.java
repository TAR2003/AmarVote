package com.amarvote.amarvote.controller;

// ElectionController.java

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.CastBallotRequest;
import com.amarvote.amarvote.dto.CastBallotResponse;
import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionDetailResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.dto.EligibilityCheckRequest;
import com.amarvote.amarvote.dto.EligibilityCheckResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.service.BallotService;
import com.amarvote.amarvote.service.ElectionService;
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
            
            System.out.println("API: Found " + accessibleElections.size() + " accessible elections - data includes all fields required by frontend");
            
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

    @PostMapping(value = "/eligibility", consumes = "application/json", produces = "application/json")
    public ResponseEntity<EligibilityCheckResponse> checkEligibility(
            @Valid @RequestBody EligibilityCheckRequest request,
            HttpServletRequest httpRequest) {
        
        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        System.out.println("Checking eligibility for election ID: " + request.getElectionId() + " by user: " + userEmail);
        
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
}