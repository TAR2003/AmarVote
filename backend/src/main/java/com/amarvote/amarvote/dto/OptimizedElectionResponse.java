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
    
    // Helper: safely convert possible JDBC / query timestamp values to Instant
    private static Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant) return (Instant) value;
        if (value instanceof java.sql.Timestamp) return ((java.sql.Timestamp) value).toInstant();
        if (value instanceof java.util.Date) return Instant.ofEpochMilli(((java.util.Date) value).getTime());
        if (value instanceof Long) return Instant.ofEpochMilli(((Long) value).longValue());
        if (value instanceof String) {
            try { return Instant.parse((String) value); } catch (java.time.format.DateTimeParseException ex) { return null; }
        }
        return null;
    }
    
    /**
     * Factory method to create an OptimizedElectionResponse from database query result
     * 
     * @param result Object array containing election data and related information
     * @return Populated OptimizedElectionResponse object
     */
    public static OptimizedElectionResponse fromQueryResult(Object[] result) {
        // The order must match the column order in the repository query
        // Query returns: e.* (all election columns), admin_name, is_admin, is_guardian, is_voter, has_voted
        int i = 0;
        
        // Election entity columns (from e.*)
        Long electionId = ((Number) result[i++]).longValue();
        String electionTitle = (String) result[i++];
        String electionDescription = (String) result[i++];
        Integer numberOfGuardians = result[i] != null ? ((Number) result[i]).intValue() : null; i++;
        Integer electionQuorum = result[i] != null ? ((Number) result[i]).intValue() : null; i++;
        Integer noOfCandidates = result[i] != null ? ((Number) result[i]).intValue() : null; i++;
        i++; // Skip jointPublicKey
        i++; // Skip manifestHash
        String status = (String) result[i++];
        Instant startingTime = toInstant(result[i++]);
        Instant endingTime = toInstant(result[i++]);
        i++; // Skip baseHash
        Instant createdAt = toInstant(result[i++]);
        String profilePic = (String) result[i++];
        String adminEmail = (String) result[i++];
        String privacy = (String) result[i++];
        String eligibility = (String) result[i++];
        
        // Additional columns from joins
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
