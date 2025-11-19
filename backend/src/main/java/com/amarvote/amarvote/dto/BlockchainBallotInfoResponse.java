package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainBallotInfoResponse {
    private boolean success;
    private String message;
    private boolean exists;
    private String electionId;
    private String ballotHash;
    private Long timestamp;
    private String trackingCode;
}
