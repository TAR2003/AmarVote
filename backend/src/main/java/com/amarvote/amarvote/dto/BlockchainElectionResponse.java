package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainElectionResponse {
    private boolean success;
    private String message;
    private String electionId;
    private String transactionHash;
    private Long blockNumber;
    private Long timestamp;
}
