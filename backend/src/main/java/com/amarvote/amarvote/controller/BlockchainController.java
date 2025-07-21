package com.amarvote.amarvote.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.BlockchainRecordDto;
import com.amarvote.amarvote.dto.BlockchainVerificationRequest;
import com.amarvote.amarvote.dto.BlockchainVerificationResponse;
import com.amarvote.amarvote.service.BlockchainService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST Controller for blockchain verification operations
 * Provides endpoints for verifying ballots on the blockchain
 */
@RestController
@RequestMapping("/api/blockchain")
@RequiredArgsConstructor
public class BlockchainController {

    @Autowired
    private BlockchainService blockchainService;

    /**
     * Verify a ballot on the blockchain
     * This endpoint allows users to verify that their ballot was recorded on the blockchain
     */
    @PostMapping("/verify-ballot")
    public ResponseEntity<BlockchainVerificationResponse> verifyBallot(
            @Valid @RequestBody BlockchainVerificationRequest request) {
        
        try {
            BlockchainVerificationResponse response = blockchainService.verifyBallotOnBlockchain(
                request.getTrackingCode(),
                request.getBallotHash(),
                request.getElectionId()
            );
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            BlockchainVerificationResponse errorResponse = BlockchainVerificationResponse.builder()
                    .verified(false)
                    .message("Verification service error: " + e.getMessage())
                    .errorReason("Service unavailable")
                    .build();
            
            return ResponseEntity.ok(errorResponse);
        }
    }

    /**
     * Get all blockchain records for an election
     * This endpoint is used for displaying verified ballots in the ballots-in-tally tab
     */
    @GetMapping("/election/{electionId}/ballots")
    public ResponseEntity<List<BlockchainRecordDto>> getElectionBallots(@PathVariable Long electionId) {
        
        try {
            List<BlockchainRecordDto> ballots = blockchainService.getBallotsByElection(electionId);
            return ResponseEntity.ok(ballots);
            
        } catch (Exception e) {
            return ResponseEntity.ok(List.of()); // Return empty list on error
        }
    }

    /**
     * Verify multiple ballots for an election
     * Bulk verification endpoint for election results page
     */
    @PostMapping("/election/{electionId}/verify-ballots")
    public ResponseEntity<List<BlockchainVerificationResponse>> verifyElectionBallots(
            @PathVariable Long electionId,
            @RequestBody List<BlockchainVerificationRequest> requests) {
        
        try {
            List<BlockchainVerificationResponse> responses = requests.stream()
                    .map(request -> blockchainService.verifyBallotOnBlockchain(
                        request.getTrackingCode(),
                        request.getBallotHash(),
                        electionId
                    ))
                    .toList();
            
            return ResponseEntity.ok(responses);
            
        } catch (Exception e) {
            return ResponseEntity.ok(List.of()); // Return empty list on error
        }
    }

    /**
     * Get blockchain health status
     * Used for checking if blockchain verification is available
     */
    @GetMapping("/health")
    public ResponseEntity<Object> getBlockchainHealth() {
        
        try {
            boolean isHealthy = blockchainService.isBlockchainHealthy();
            
            return ResponseEntity.ok(new Object() {
                public boolean healthy = isHealthy;
                public String message = isHealthy ? "Blockchain is operational" : "Blockchain service unavailable";
                public long timestamp = System.currentTimeMillis();
            });
            
        } catch (Exception e) {
            return ResponseEntity.ok(new Object() {
                public boolean healthy = false;
                public String message = "Health check failed: " + e.getMessage();
                public long timestamp = System.currentTimeMillis();
            });
        }
    }

    /**
     * Get current user's blockchain verification status
     * Returns information about user's ballots that are recorded on blockchain
     */
    @GetMapping("/my-ballots")
    public ResponseEntity<List<BlockchainRecordDto>> getUserBlockchainBallots() {
        
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.ok(List.of());
            }

            // This would need to be implemented to filter by user
            // For now, return empty list as this would require user-ballot mapping
            return ResponseEntity.ok(List.of());
            
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * Get blockchain statistics for an election
     * Provides metrics about blockchain verification coverage
     */
    @GetMapping("/election/{electionId}/stats")
    public ResponseEntity<Object> getElectionBlockchainStats(@PathVariable Long electionId) {
        
        try {
            List<BlockchainRecordDto> ballots = blockchainService.getBallotsByElection(electionId);
            
            long verifiedCount = ballots.stream()
                    .filter(ballot -> "VERIFIED".equals(ballot.getVerificationStatus()))
                    .count();
            
            return ResponseEntity.ok(new Object() {
                public long totalBallots = ballots.size();
                public long verifiedBallots = verifiedCount;
                public double verificationRate = ballots.isEmpty() ? 0.0 : (double) verifiedCount / ballots.size() * 100;
                public String status = verifiedCount == ballots.size() ? "Complete" : "Partial";
                public long timestamp = System.currentTimeMillis();
            });
            
        } catch (Exception e) {
            return ResponseEntity.ok(new Object() {
                public long totalBallots = 0;
                public long verifiedBallots = 0;
                public double verificationRate = 0.0;
                public String status = "Error";
                public String error = e.getMessage();
                public long timestamp = System.currentTimeMillis();
            });
        }
    }
}
