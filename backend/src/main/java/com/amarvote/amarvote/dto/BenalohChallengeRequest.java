package com.amarvote.amarvote.dto;

import java.util.List;

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
    private List<String> candidate_names_to_verify; // The candidate names the user wants to verify
}