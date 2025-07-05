package com.amarvote.amarvote.dto;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Optimized DTO for election responses to avoid N+1 query issues
 * This DTO is used for fetching and displaying hundreds of elections efficiently
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptimizedElectionResponse {
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
    private List<String> userRoles;
    
    // Indicates if the election is public (no allowed voters) or private (has allowed voters)
    private Boolean isPublic;
    
    // Election eligibility criteria
    private String eligibility; // "listed" or "unlisted"
    
    // Indicates if the current user has already voted in this election
    private Boolean hasVoted;
    
    /**
     * Factory method to create an OptimizedElectionResponse from database query result
     * 
     * @param result Object array containing election data and related information
     * @return Populated OptimizedElectionResponse object
     */
    public static OptimizedElectionResponse fromQueryResult(Object[] result) {
        // The order must match the column order in the repository query
        int i = 0;
        
        Long electionId = ((Number) result[i++]).longValue();
        String electionTitle = (String) result[i++];
        String electionDescription = (String) result[i++];
        Integer numberOfGuardians = (Integer) result[i++];
        Integer electionQuorum = (Integer) result[i++];
        Integer noOfCandidates = (Integer) result[i++];
        i++; // Skip jointPublicKey
        i++; // Skip manifestHash
        String status = (String) result[i++];
        Instant startingTime = (Instant) result[i++];
        Instant endingTime = (Instant) result[i++];
        i++; // Skip encryptedTally
        i++; // Skip baseHash
        Instant createdAt = (Instant) result[i++];
        String profilePic = (String) result[i++];
        String adminEmail = (String) result[i++];
        String privacy = (String) result[i++];
        String eligibility = (String) result[i++];
        String adminName = (String) result[i++];
        Boolean isAdmin = (Boolean) result[i++];
        Boolean isGuardian = (Boolean) result[i++];
        Boolean isVoter = (Boolean) result[i++];
        Boolean hasVoted = (Boolean) result[i++];
        
        // Build user roles list
        List<String> userRoles = new ArrayList<>();
        if (Boolean.TRUE.equals(isAdmin)) {
            userRoles.add("admin");
        }
        if (Boolean.TRUE.equals(isGuardian)) {
            userRoles.add("guardian");
        }
        if (Boolean.TRUE.equals(isVoter)) {
            userRoles.add("voter");
        }
        
        // Determine if election is public
        boolean isPublic = "public".equals(privacy);
        
        return OptimizedElectionResponse.builder()
                .electionId(electionId)
                .electionTitle(electionTitle)
                .electionDescription(electionDescription)
                .status(status)
                .startingTime(startingTime)
                .endingTime(endingTime)
                .profilePic(profilePic)
                .adminEmail(adminEmail)
                .adminName(adminName)
                .numberOfGuardians(numberOfGuardians)
                .electionQuorum(electionQuorum)
                .noOfCandidates(noOfCandidates)
                .createdAt(createdAt)
                .userRoles(userRoles)
                .isPublic(isPublic)
                .eligibility(eligibility)
                .hasVoted(hasVoted)
                .build();
    }
}
