package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateEncryptedBallotResponse {
    
    private boolean success;
    private String message;
    private String errorReason;
    private String encrypted_ballot;
    private String encrypted_ballot_with_nonce;
    private String ballot_hash;
    private String ballot_tracking_code;
    private String ballot_id;
}