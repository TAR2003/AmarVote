package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EligibilityCheckResponse {
    
    private boolean eligible;
    private String message;
    private String reason;
    private boolean hasVoted;
    private boolean isElectionActive;
    private String electionStatus;
}
