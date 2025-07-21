package com.amarvote.amarvote.dto;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for blockchain record information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainRecordDto {
    
    private Long recordId;
    private Long electionId;
    private String trackingCode;
    private String ballotHash;
    private String transactionId;
    private String blockNumber;
    private String verificationStatus;
    private Instant blockchainTimestamp;
    private Instant createdAt;
}
