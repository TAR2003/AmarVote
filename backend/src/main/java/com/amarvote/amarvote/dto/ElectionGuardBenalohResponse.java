package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionGuardBenalohResponse {
    
    private String status;
    private String ballot_id;
    private String expected_candidate;
    private boolean match;
    private String message;
    private String verified_candidate;
}