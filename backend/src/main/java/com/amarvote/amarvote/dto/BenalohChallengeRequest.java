package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BenalohChallengeRequest {
    
    private Long electionId;
    private String encrypted_ballot_with_nonce;
    private String candidate_name; // The candidate name user wants to verify
}