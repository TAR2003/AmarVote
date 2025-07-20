package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CastBallotRequest {
    
    @NotNull(message = "Election ID is required")
    private Long electionId;
    
    @NotBlank(message = "Selected candidate is required")
    private String selectedCandidate;
    
    // Bot detection data (optional)
    private BotDetectionData botDetection;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BotDetectionData {
        private Boolean isBot;
        private String requestId;
        private String timestamp;
    }
}
