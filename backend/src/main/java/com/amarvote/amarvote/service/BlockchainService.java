package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.BlockchainRecordDto;
import com.amarvote.amarvote.dto.BlockchainVerificationResponse;
import com.amarvote.amarvote.model.BlockchainRecord;
import com.amarvote.amarvote.repository.BlockchainRecordRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;

/**
 * Service for interacting with Hyperledger Fabric blockchain network
 * Handles ballot verification and blockchain recording operations
 */
@Service
@RequiredArgsConstructor
public class BlockchainService {

    private static final Logger logger = LoggerFactory.getLogger(BlockchainService.class);

    @Autowired
    private BlockchainRecordRepository blockchainRecordRepository;

    @Autowired
    private WebClient webClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${blockchain.fabric.gateway.url:http://localhost:3001}")
    private String fabricGatewayUrl;

    @Value("${blockchain.fabric.enabled:true}")
    private boolean blockchainEnabled;

    /**
     * Asynchronously record ballot data to blockchain after successful ballot casting
     * This method is called after a ballot is successfully saved to the database
     */
    @Async
    @Transactional
    public CompletableFuture<Void> recordBallotToBlockchain(Long electionId, String trackingCode, String ballotHash) {
        if (!blockchainEnabled) {
            logger.info("Blockchain is disabled. Skipping ballot recording for tracking code: {}", trackingCode);
            return CompletableFuture.completedFuture(null);
        }

        try {
            logger.info("🔗 Recording ballot to blockchain - Election ID: {}, Tracking Code: {}", electionId, trackingCode);

            // Create initial blockchain record with PENDING status
            BlockchainRecord record = BlockchainRecord.builder()
                    .electionId(electionId)
                    .trackingCode(trackingCode)
                    .ballotHash(ballotHash)
                    .verificationStatus("PENDING")
                    .retryCount(0)
                    .build();
            
            BlockchainRecord savedRecord = blockchainRecordRepository.save(record);

            // Call Hyperledger Fabric chaincode to record ballot
            recordBallotOnFabric(electionId.toString(), trackingCode, ballotHash)
                .doOnSuccess(response -> {
                    logger.info("✅ Successfully recorded ballot to blockchain: {}", response);
                    updateBlockchainRecordStatus(savedRecord.getRecordId(), "RECORDED", response, null);
                })
                .doOnError(error -> {
                    logger.error("❌ Failed to record ballot to blockchain for tracking code: {}", trackingCode, error);
                    updateBlockchainRecordStatus(savedRecord.getRecordId(), "FAILED", null, error.getMessage());
                })
                .subscribe();

        } catch (Exception e) {
            logger.error("❌ Unexpected error recording ballot to blockchain for tracking code: {}", trackingCode, e);
        }

        return CompletableFuture.completedFuture(null);
    }

    /**
     * Verify ballot exists on blockchain and matches the provided data
     */
    public BlockchainVerificationResponse verifyBallotOnBlockchain(String trackingCode, String ballotHash, Long electionId) {
        if (!blockchainEnabled) {
            return BlockchainVerificationResponse.builder()
                    .verified(false)
                    .message("Blockchain verification is currently disabled")
                    .build();
        }

        try {
            logger.info("🔍 Verifying ballot on blockchain - Tracking Code: {}", trackingCode);

            // First check our local blockchain record
            Optional<BlockchainRecord> localRecord = blockchainRecordRepository.findByTrackingCode(trackingCode);
            if (localRecord.isEmpty()) {
                return BlockchainVerificationResponse.builder()
                        .verified(false)
                        .message("No blockchain record found for this ballot")
                        .build();
            }

            BlockchainRecord record = localRecord.get();
            
            // If already verified, return cached result
            if ("VERIFIED".equals(record.getVerificationStatus())) {
                return BlockchainVerificationResponse.builder()
                        .verified(true)
                        .message("Ballot verified on blockchain")
                        .blockchainTimestamp(record.getBlockchainTimestamp())
                        .transactionId(record.getTransactionId())
                        .blockNumber(record.getBlockNumber())
                        .build();
            }

            // Query blockchain for verification
            return verifyBallotOnFabric(trackingCode, ballotHash)
                    .map(this::parseVerificationResponse)
                    .doOnSuccess(response -> {
                        if (response.isVerified()) {
                            updateBlockchainRecordStatus(record.getRecordId(), "VERIFIED", 
                                response.getTransactionId(), null);
                        }
                    })
                    .onErrorReturn(BlockchainVerificationResponse.builder()
                            .verified(false)
                            .message("Blockchain verification failed")
                            .build())
                    .doOnError(error -> {
                        logger.error("❌ Blockchain verification failed for tracking code: {}", trackingCode, error);
                    })
                    .block(); // Convert to synchronous for REST API

        } catch (Exception e) {
            logger.error("❌ Unexpected error during blockchain verification for tracking code: {}", trackingCode, e);
            return BlockchainVerificationResponse.builder()
                    .verified(false)
                    .message("Verification service error: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Get all ballots from blockchain for a specific election
     */
    public List<BlockchainRecordDto> getBallotsByElection(Long electionId) {
        try {
            logger.info("📋 Retrieving blockchain records for election: {}", electionId);
            
            List<BlockchainRecord> records = blockchainRecordRepository.findByElectionIdAndVerificationStatus(
                electionId, "VERIFIED");
            
            return records.stream()
                    .map(this::convertToDto)
                    .toList();
                    
        } catch (Exception e) {
            logger.error("❌ Error retrieving blockchain records for election: {}", electionId, e);
            return List.of();
        }
    }

    /**
     * Call Hyperledger Fabric chaincode to record a ballot
     */
    private Mono<String> recordBallotOnFabric(String electionId, String trackingCode, String ballotHash) {
        String fabricEndpoint = fabricGatewayUrl + "/record-ballot";
        
        String requestBody = String.format("""
            {
                "electionId": "%s",
                "trackingCode": "%s",
                "ballotHash": "%s",
                "timestamp": "%s"
            }
            """, electionId, trackingCode, ballotHash, Instant.now().toString());

        return webClient.post()
                .uri(fabricEndpoint)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(java.time.Duration.ofSeconds(30));
    }

    /**
     * Call Hyperledger Fabric chaincode to verify a ballot
     */
    private Mono<String> verifyBallotOnFabric(String trackingCode, String ballotHash) {
        String fabricEndpoint = fabricGatewayUrl + "/verify-ballot";
        
        String requestBody = String.format("""
            {
                "trackingCode": "%s",
                "ballotHash": "%s"
            }
            """, trackingCode, ballotHash);

        return webClient.post()
                .uri(fabricEndpoint)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(java.time.Duration.ofSeconds(30));
    }

    /**
     * Parse blockchain verification response
     */
    private BlockchainVerificationResponse parseVerificationResponse(String response) {
        try {
            JsonNode jsonNode = objectMapper.readTree(response);
            
            boolean verified = jsonNode.get("verified").asBoolean(false);
            String message = jsonNode.get("message").asText("Unknown status");
            
            BlockchainVerificationResponse.BlockchainVerificationResponseBuilder builder = 
                BlockchainVerificationResponse.builder()
                    .verified(verified)
                    .message(message);

            if (verified) {
                if (jsonNode.has("timestamp")) {
                    builder.blockchainTimestamp(Instant.parse(jsonNode.get("timestamp").asText()));
                }
                if (jsonNode.has("transactionId")) {
                    builder.transactionId(jsonNode.get("transactionId").asText());
                }
                if (jsonNode.has("blockNumber")) {
                    builder.blockNumber(jsonNode.get("blockNumber").asText());
                }
            }

            return builder.build();

        } catch (Exception e) {
            logger.error("❌ Error parsing blockchain response: {}", response, e);
            return BlockchainVerificationResponse.builder()
                    .verified(false)
                    .message("Failed to parse blockchain response")
                    .build();
        }
    }

    /**
     * Update blockchain record status in database
     */
    @Transactional
    private void updateBlockchainRecordStatus(Long recordId, String status, String transactionId, String errorMessage) {
        try {
            Optional<BlockchainRecord> recordOpt = blockchainRecordRepository.findById(recordId);
            if (recordOpt.isPresent()) {
                BlockchainRecord record = recordOpt.get();
                record.setVerificationStatus(status);
                record.setTransactionId(transactionId);
                record.setErrorMessage(errorMessage);
                
                if ("RECORDED".equals(status) || "VERIFIED".equals(status)) {
                    record.setBlockchainTimestamp(Instant.now());
                }
                
                blockchainRecordRepository.save(record);
                logger.info("📝 Updated blockchain record status to {} for record ID: {}", status, recordId);
            }
        } catch (Exception e) {
            logger.error("❌ Failed to update blockchain record status for record ID: {}", recordId, e);
        }
    }

    /**
     * Convert BlockchainRecord entity to DTO
     */
    private BlockchainRecordDto convertToDto(BlockchainRecord record) {
        return BlockchainRecordDto.builder()
                .recordId(record.getRecordId())
                .electionId(record.getElectionId())
                .trackingCode(record.getTrackingCode())
                .ballotHash(record.getBallotHash())
                .transactionId(record.getTransactionId())
                .blockNumber(record.getBlockNumber())
                .verificationStatus(record.getVerificationStatus())
                .blockchainTimestamp(record.getBlockchainTimestamp())
                .createdAt(record.getCreatedAt())
                .build();
    }

    /**
     * Health check for blockchain connectivity
     */
    public boolean isBlockchainHealthy() {
        if (!blockchainEnabled) {
            return false;
        }

        try {
            String healthEndpoint = fabricGatewayUrl + "/health";
            
            String response = webClient.get()
                    .uri(healthEndpoint)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(java.time.Duration.ofSeconds(10))
                    .block();

            return response != null && response.contains("healthy");

        } catch (Exception e) {
            logger.warn("⚠️ Blockchain health check failed: {}", e.getMessage());
            return false;
        }
    }
}
