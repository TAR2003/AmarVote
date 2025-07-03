package com.amarvote.amarvote.dto;

import java.time.Instant;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionResponse {
    private Long electionId;
    private String electionTitle;
    private String electionDescription;
    private String status;
    private Instant startingTime;
    private Instant endingTime;
    private String profilePic;
    private String adminEmail;
    private String adminName;
    private Integer numberOfGuardians;
    private Integer electionQuorum;
    private Integer noOfCandidates;
    private Instant createdAt;
    
    // User roles in this election
    private List<String> userRoles; // Can contain "voter", "admin", "guardian"
    
    // Indicates if the election is public (no allowed voters) or private (has allowed voters)
    private Boolean isPublic;
    
    // Note: Sensitive fields like jointPublicKey, manifestHash, baseHash, etc. 
    // are not included in this response DTO for security reasons
}
