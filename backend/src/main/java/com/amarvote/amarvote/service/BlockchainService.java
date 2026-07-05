package com.amarvote.amarvote.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import com.amarvote.amarvote.dto.BlockchainBallotInfoResponse;
import com.amarvote.amarvote.dto.BlockchainElectionRequest;
import com.amarvote.amarvote.dto.BlockchainElectionResponse;
import com.amarvote.amarvote.dto.BlockchainLogsResponse;
import com.amarvote.amarvote.dto.BlockchainRecordBallotRequest;
import com.amarvote.amarvote.dto.BlockchainRecordBallotResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Service for interacting with the blockchain voting API
 * Handles all blockchain-related operations including:
 * - Creating elections on blockchain
 * - Recording ballots on blockchain
 * - Verifying ballots from blockchain
 * - Retrieving election logs from blockchain
 */
@Service
public class BlockchainService {
    
    private static final Logger logger = LoggerFactory.getLogger(BlockchainService.class);

    @Value("${blockchain.service.url:}")
    private String blockchainServiceUrl;

    @Value("${blockchain.enabled:false}")
    private boolean blockchainEnabled;
    
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    public BlockchainService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    private boolean isBlockchainDisabled() {
        return !blockchainEnabled;
    }
    
    /**
     * Create an election on the blockchain
     * @return Response from blockchain service
     */
    public BlockchainElectionResponse createElection(String electionId) {
        if (isBlockchainDisabled()) {
            logger.debug("Blockchain disabled — skipping createElection for {}", electionId);
            return BlockchainElectionResponse.builder()
                    .success(false)
                    .message("Blockchain integration is disabled")
                    .build();
        }
        try {
            String url = blockchainServiceUrl + "/create-election";
            
            // Create request body
            BlockchainElectionRequest request = new BlockchainElectionRequest(electionId);
            
            // Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            // Create HTTP entity
            HttpEntity<BlockchainElectionRequest> entity = new HttpEntity<>(request, headers);
            
            // Make request
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response.getBody());
            
            if ("success".equals(responseNode.get("status").asText())) {
                logger.info("Successfully created election {} on blockchain", electionId);
                return BlockchainElectionResponse.builder()
                    .success(true)
                    .electionId(responseNode.get("election_id").asText())
                    .transactionHash(responseNode.get("transaction_hash").asText())
                    .blockNumber(responseNode.get("block_number").asLong())
                    .timestamp(responseNode.get("timestamp").asLong())
                    .message(responseNode.get("message").asText())
                    .build();
            } else {
                logger.error("Failed to create election {} on blockchain: {}", electionId, responseNode.get("message").asText());
                return BlockchainElectionResponse.builder()
                    .success(false)
                    .message(responseNode.has("message") ? responseNode.get("message").asText() : "Failed to create election on blockchain")
                    .build();
            }
            
        } catch (ResourceAccessException e) {
            logger.error("Blockchain service is not available: {}", e.getMessage());
            return BlockchainElectionResponse.builder()
                .success(false)
                .message("Blockchain service is currently unavailable")
                .build();
        } catch (Exception e) {
            logger.error("Error creating election {} on blockchain: {}", electionId, e.getMessage());
            return BlockchainElectionResponse.builder()
                .success(false)
                .message("Error creating election on blockchain: " + e.getMessage())
                .build();
        }
    }
    
    /**
     * Fire-and-forget blockchain record — must not run inside a DB transaction.
     */
    @Async
    public void recordBallotAsync(String electionId, String trackingCode, String ballotHash) {
        if (isBlockchainDisabled()) {
            return;
        }
        BlockchainRecordBallotResponse response = recordBallot(electionId, trackingCode, ballotHash);
        if (response == null || !response.isSuccess()) {
            String message = response != null ? response.getMessage() : "null response";
            logger.warn("Async blockchain record failed for election {} tracking {}: {}",
                    electionId, trackingCode, message);
        }
    }

    public BlockchainRecordBallotResponse recordBallot(String electionId, String trackingCode, String ballotHash) {
        if (isBlockchainDisabled()) {
            logger.debug("Blockchain disabled — skipping recordBallot for {}", trackingCode);
            return BlockchainRecordBallotResponse.builder()
                    .success(false)
                    .message("Blockchain integration is disabled")
                    .build();
        }
        try {
            String url = blockchainServiceUrl + "/record-ballot";
            
            // Create request body
            BlockchainRecordBallotRequest request = new BlockchainRecordBallotRequest(electionId, trackingCode, ballotHash);
            
            // Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            // Create HTTP entity
            HttpEntity<BlockchainRecordBallotRequest> entity = new HttpEntity<>(request, headers);
            
            // Make request
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response.getBody());
            
            if ("success".equals(responseNode.get("status").asText())) {
                logger.info("Successfully recorded ballot {} for election {} on blockchain", trackingCode, electionId);
                return BlockchainRecordBallotResponse.builder()
                    .success(true)
                    .transactionHash(responseNode.get("transaction_hash").asText())
                    .blockNumber(responseNode.get("block_number").asLong())
                    .timestamp(responseNode.get("timestamp").asLong())
                    .message(responseNode.get("message").asText())
                    .build();
            } else {
                logger.error("Failed to record ballot {} for election {} on blockchain: {}", trackingCode, electionId, responseNode.get("message").asText());
                return BlockchainRecordBallotResponse.builder()
                    .success(false)
                    .message(responseNode.has("message") ? responseNode.get("message").asText() : "Failed to record ballot on blockchain")
                    .build();
            }
            
        } catch (ResourceAccessException e) {
            logger.error("Blockchain service is not available: {}", e.getMessage());
            return BlockchainRecordBallotResponse.builder()
                .success(false)
                .message("Blockchain service is currently unavailable")
                .build();
        } catch (Exception e) {
            logger.error("Error recording ballot {} for election {} on blockchain: {}", trackingCode, electionId, e.getMessage());
            return BlockchainRecordBallotResponse.builder()
                .success(false)
                .message("Error recording ballot on blockchain: " + e.getMessage())
                .build();
        }
    }
    
    /**
     * Get ballot information from blockchain
     * @param electionId The election identifier
     * @param trackingCode The ballot tracking code
     * @return Ballot information from blockchain
     */
    public BlockchainBallotInfoResponse getBallotInfo(String electionId, String trackingCode) {
        if (isBlockchainDisabled()) {
            return BlockchainBallotInfoResponse.builder()
                    .success(false)
                    .message("Blockchain integration is disabled")
                    .build();
        }
        try {
            String url = blockchainServiceUrl + "/ballot/" + electionId + "/" + trackingCode;
            
            // Make request
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response.getBody());
            
            if ("success".equals(responseNode.get("status").asText())) {
                JsonNode result = responseNode.get("result");
                logger.info("Successfully retrieved ballot info for {} in election {}", trackingCode, electionId);
                
                return BlockchainBallotInfoResponse.builder()
                    .success(true)
                    .exists(result.get("exists").asBoolean())
                    .electionId(result.get("election_id").asText())
                    .ballotHash(result.get("ballot_hash").asText())
                    .timestamp(result.get("timestamp").asLong())
                    .trackingCode(result.get("tracking_code").asText())
                    .build();
            } else {
                logger.error("Failed to retrieve ballot info for {} in election {}: {}", trackingCode, electionId, responseNode.get("message").asText());
                return BlockchainBallotInfoResponse.builder()
                    .success(false)
                    .exists(false)
                    .message(responseNode.has("message") ? responseNode.get("message").asText() : "Failed to retrieve ballot info")
                    .build();
            }
            
        } catch (ResourceAccessException e) {
            logger.error("Blockchain service is not available: {}", e.getMessage());
            return BlockchainBallotInfoResponse.builder()
                .success(false)
                .exists(false)
                .message("Blockchain service is currently unavailable")
                .build();
        } catch (Exception e) {
            logger.error("Error retrieving ballot info for {} in election {}: {}", trackingCode, electionId, e.getMessage());
            return BlockchainBallotInfoResponse.builder()
                .success(false)
                .exists(false)
                .message("Error retrieving ballot info: " + e.getMessage())
                .build();
        }
    }
    
    /**
     * Get election logs from blockchain
     * @param electionId The election identifier
     * @return Election logs from blockchain
     */
    public BlockchainLogsResponse getElectionLogs(String electionId) {
        if (isBlockchainDisabled()) {
            return BlockchainLogsResponse.builder()
                    .success(false)
                    .message("Blockchain integration is disabled")
                    .build();
        }
        try {
            // Enhanced logging for debugging
            logger.info("🔍 Attempting to retrieve blockchain logs for election: {}", electionId);
            logger.info("🔗 Blockchain service URL configured as: {}", blockchainServiceUrl);
            
            if (blockchainServiceUrl == null || blockchainServiceUrl.trim().isEmpty()) {
                logger.error("❌ Blockchain service URL is not configured! Check BLOCKCHAIN_SERVICE_URL environment variable.");
                return BlockchainLogsResponse.builder()
                    .success(false)
                    .message("Blockchain service URL is not configured")
                    .build();
            }
            
            String url = blockchainServiceUrl + "/get-logs/" + electionId;
            logger.info("📡 Making request to blockchain microservice: {}", url);

            // Make request and get String first for better error handling
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            logger.info("📨 Received response from blockchain service - Status: {}, Body length: {}", 
                       response.getStatusCode(), response.getBody() != null ? response.getBody().length() : 0);
            
            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                logger.error("❌ Empty response from blockchain service");
                return BlockchainLogsResponse.builder()
                    .success(false)
                    .message("Empty response from blockchain service")
                    .build();
            }
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response.getBody());
            logger.info("📋 Parsed blockchain response: status={}, message={}", 
                       responseNode.path("status").asText("N/A"), 
                       responseNode.path("message").asText("N/A"));
            
            if (responseNode != null && "success".equals(responseNode.path("status").asText())) {
                logger.info("✅ Successfully retrieved logs for election {}", electionId);
                
                // Check if we have the expected structure
                JsonNode resultNode = responseNode.path("result");
                if (resultNode.isMissingNode()) {
                    logger.error("❌ Missing 'result' field in blockchain response");
                    return BlockchainLogsResponse.builder()
                        .success(false)
                        .message("Invalid response structure from blockchain service")
                        .build();
                }
                
                // The microservice response is deserialized into the DTO
                BlockchainLogsResponse logsResponse = objectMapper.treeToValue(responseNode, BlockchainLogsResponse.class);
                
                // Log successful parsing details
                if (logsResponse.getResult() != null) {
                    logger.info("📊 Blockchain logs parsed successfully - Election: {}, Log count: {}", 
                               logsResponse.getResult().getElection_id(), 
                               logsResponse.getResult().getLog_count());
                } else {
                    logger.warn("⚠️ Blockchain logs response has null result");
                }
                logsResponse.setSuccess(true);
                logsResponse.setMessage("Successfully retrieved election logs");
                return logsResponse;
            } else {
                String message = responseNode != null ? responseNode.path("message").asText("Failed to retrieve election logs") : "Failed to retrieve election logs";
                logger.error("❌ Failed to retrieve logs for election {}: {}", electionId, message);
                return BlockchainLogsResponse.builder()
                    .success(false)
                    .message(message)
                    .build();
            }
            
        } catch (ResourceAccessException e) {
            logger.error("🚫 Blockchain service is not available at {}: {}", blockchainServiceUrl, e.getMessage());
            return BlockchainLogsResponse.builder()
                .success(false)
                .message("Blockchain service is currently unavailable: " + e.getMessage())
                .build();
        } catch (Exception e) {
            logger.error("⚠️ Error retrieving logs for election {}: {}", electionId, e.getMessage(), e);
            return BlockchainLogsResponse.builder()
                .success(false)
                .message("Error retrieving election logs: " + e.getMessage())
                .build();
        }
    }
    
    /**
     * Health check for blockchain service
     * @return true if service is healthy, false otherwise
     */
    public boolean isBlockchainServiceHealthy() {
        if (isBlockchainDisabled()) {
            return false;
        }
        try {
            String url = blockchainServiceUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            JsonNode responseNode = objectMapper.readTree(response.getBody());
            return "connected".equals(responseNode.get("blockchain").asText());
        } catch (Exception e) {
            logger.warn("Blockchain service health check failed: {}", e.getMessage());
            return false;
        }
    }
}
