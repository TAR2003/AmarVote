package com.amarvote.amarvote.dto;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for blockchain verification operations
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainVerificationResponse {
    
    private boolean verified;
    private String message;
    private Instant blockchainTimestamp;
    private String transactionId;
    private String blockNumber;
    private String errorReason;
}
