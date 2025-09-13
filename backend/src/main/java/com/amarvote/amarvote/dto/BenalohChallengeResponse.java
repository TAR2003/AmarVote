package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BenalohChallengeResponse {
    
    private boolean success;
    private String message;
    private String errorReason;
    private boolean match;
    private String verified_candidate;
    private String expected_candidate;
    private String ballot_id;
}