package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CastEncryptedBallotRequest {
    
    private Long electionId;
    private String encrypted_ballot;
    private String ballot_hash;
    private String ballot_tracking_code;
}