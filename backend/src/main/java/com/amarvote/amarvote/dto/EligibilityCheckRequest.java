package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EligibilityCheckRequest {
    
    @NotNull(message = "Election ID is required")
    private Long electionId;
}
