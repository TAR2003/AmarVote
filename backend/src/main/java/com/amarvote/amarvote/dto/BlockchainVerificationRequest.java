package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for blockchain verification operations
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainVerificationRequest {
    
    @NotBlank(message = "Tracking code is required")
    private String trackingCode;
    
    @NotBlank(message = "Ballot hash is required")
    private String ballotHash;
    
    @NotNull(message = "Election ID is required")
    private Long electionId;
}
