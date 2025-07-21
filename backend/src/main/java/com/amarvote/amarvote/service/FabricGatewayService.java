package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Service for interacting with Hyperledger Fabric blockchain network
 * Communicates with the Node.js blockchain gateway via HTTP REST API
 */
@Service
public class FabricGatewayService {

    private static final Logger logger = LoggerFactory.getLogger(FabricGatewayService.class);
    
    @Value("${blockchain.gateway.url:http://blockchain-gateway:3001}")
    private String gatewayUrl;
    
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    
    public FabricGatewayService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Records a ballot on the blockchain for verification
     */
    public String recordBallot(String ballotId, String voterCnicHash, String ballotData, String candidateSelections) {
        logger.info("Recording ballot on blockchain: {}", ballotId);
        
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("ballotId", ballotId);
            request.put("voterCnicHash", voterCnicHash);
            request.put("ballotData", ballotData);
            request.put("candidateSelections", candidateSelections);
            request.put("timestamp", Instant.now().toString());
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                gatewayUrl + "/api/ballot",
                HttpMethod.POST,
                entity,
                String.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                logger.info("Successfully recorded ballot {} on blockchain", ballotId);
                return response.getBody();
            } else {
                logger.error("Failed to record ballot {}: HTTP {}", ballotId, response.getStatusCode());
                return null;
            }
            
        } catch (ResourceAccessException e) {
            logger.warn("Blockchain gateway not available for ballot {}: {}", ballotId, e.getMessage());
            return null; // Gracefully handle when blockchain is not available
        } catch (Exception e) {
            logger.error("Error recording ballot {} on blockchain: {}", ballotId, e.getMessage(), e);
            return null;
        }
    }

    /**
     * Verifies a ballot exists on the blockchain
     */
    public boolean verifyBallot(String ballotId) {
        logger.info("Verifying ballot on blockchain: {}", ballotId);
        
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                gatewayUrl + "/api/ballot/" + ballotId,
                String.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                boolean exists = responseJson.has("ballotId") && 
                               ballotId.equals(responseJson.get("ballotId").asText());
                
                logger.info("Ballot {} verification result: {}", ballotId, exists);
                return exists;
            } else {
                logger.warn("Ballot {} not found on blockchain: HTTP {}", ballotId, response.getStatusCode());
                return false;
            }
            
        } catch (ResourceAccessException e) {
            logger.warn("Blockchain gateway not available for verification of ballot {}: {}", ballotId, e.getMessage());
            return false;
        } catch (Exception e) {
            logger.error("Error verifying ballot {} on blockchain: {}", ballotId, e.getMessage(), e);
            return false;
        }
    }

    /**
     * Record a ballot on the blockchain (legacy method for compatibility)
     */
    public String recordBallot(String electionId, String trackingCode, String ballotHash) throws Exception {
        logger.info("🔗 Recording ballot to blockchain - Election: {}, Tracking: {}", electionId, trackingCode);
        
        String result = recordBallot(trackingCode, electionId, ballotHash, "");
        if (result != null) {
            logger.info("✅ Ballot recorded successfully: {}", result);
            return result;
        } else {
            throw new Exception("Failed to record ballot on blockchain");
        }
    }

    /**
     * Verify a ballot on the blockchain (legacy method for compatibility)
     */
    public String verifyBallot(String trackingCode, String ballotHash) throws Exception {
        logger.info("🔍 Verifying ballot on blockchain - Tracking: {}", trackingCode);
        
        boolean verified = verifyBallot(trackingCode);
        
        if (verified) {
            logger.info("✅ Ballot verified successfully on blockchain");
            return createVerificationResponse(true, "Ballot verified on blockchain", 
                Instant.now().toString(), "tx-" + trackingCode, "block-" + System.currentTimeMillis());
        } else {
            logger.warn("⚠️ Ballot verification failed");
            return createVerificationResponse(false, "Ballot not found on blockchain", null, null, null);
        }
    }

    /**
     * Gets blockchain statistics and health
     */
    public Map<String, Object> getBlockchainStats() {
        logger.info("Getting blockchain statistics");
        
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                gatewayUrl + "/api/stats",
                String.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                @SuppressWarnings("unchecked")
                Map<String, Object> stats = objectMapper.convertValue(responseJson, Map.class);
                logger.info("Retrieved blockchain statistics successfully");
                return stats;
            } else {
                logger.warn("Failed to get blockchain stats: HTTP {}", response.getStatusCode());
                return Map.of("error", "Failed to retrieve stats");
            }
            
        } catch (ResourceAccessException e) {
            logger.warn("Blockchain gateway not available for stats: {}", e.getMessage());
            return Map.of("error", "Blockchain gateway not available", "available", false);
        } catch (Exception e) {
            logger.error("Error getting blockchain stats: {}", e.getMessage(), e);
            return Map.of("error", "Internal error retrieving stats");
        }
    }

    /**
     * Get all ballots for an election from blockchain
     */
    public String getBallotsByElection(String electionId) throws Exception {
        logger.info("📋 Getting ballots for election {} from blockchain", electionId);
        
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                gatewayUrl + "/api/ballots",
                String.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                logger.info("✅ Retrieved ballots for election {}", electionId);
                return response.getBody();
            } else {
                logger.warn("Failed to get ballots: HTTP {}", response.getStatusCode());
                return "[]";
            }
            
        } catch (ResourceAccessException e) {
            logger.warn("Blockchain gateway not available for ballot retrieval: {}", e.getMessage());
            return "[]";
        } catch (Exception e) {
            logger.error("Error getting ballots from blockchain: {}", e.getMessage(), e);
            return "[]";
        }
    }

    /**
     * Check blockchain health
     */
    public boolean isHealthy() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                gatewayUrl + "/health",
                String.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                boolean healthy = responseJson.has("status") && 
                                "healthy".equals(responseJson.get("status").asText());
                
                logger.debug("Blockchain gateway health check: {}", healthy);
                return healthy;
            }
            
        } catch (ResourceAccessException e) {
            logger.debug("Blockchain gateway health check failed: {}", e.getMessage());
        } catch (Exception e) {
            logger.warn("Error checking blockchain health: {}", e.getMessage());
        }
        
        return false;
    }

    /**
     * Create verification response JSON
     */
    private String createVerificationResponse(boolean verified, String message, String timestamp, String transactionId, String blockNumber) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("verified", verified);
            response.put("message", message);
            response.put("timestamp", timestamp);
            response.put("transactionId", transactionId);
            response.put("blockNumber", blockNumber);
            
            return objectMapper.writeValueAsString(response);
        } catch (Exception e) {
            logger.error("❌ Failed to create verification response", e);
            return "{\"verified\":false,\"message\":\"Response creation failed\"}";
        }
    }

    /**
     * Initialize user identity - No longer needed with HTTP gateway
     */
    public void initializeIdentity(String certificatePem, String privateKeyPem) throws Exception {
        logger.info("Identity initialization not required with HTTP gateway");
    }
}
