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
public class ElectionDetailResponse {
    // Election Information
    private Long electionId;
    private String electionTitle;
    private String electionDescription;
    private Integer numberOfGuardians;
    private Integer electionQuorum;
    private Integer noOfCandidates;
    private String jointPublicKey;
    private String manifestHash;
    private String status;
    private Instant startingTime;
    private Instant endingTime;
    private String encryptedTally;
    private String baseHash;
    private Instant createdAt;
    private String profilePic;
    private String adminEmail;
    private String adminName;
    
    // Guardian Information
    private List<GuardianInfo> guardians;
    
    // Voter Information
    private List<VoterInfo> voters;
    
    // Election Choices
    private List<ElectionChoiceInfo> electionChoices;
    
    // User roles in this election
    private List<String> userRoles; // Can contain "voter", "admin", "guardian"
    
    // Indicates if the election is public (no allowed voters) or private (has allowed voters)
    private Boolean isPublic;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GuardianInfo {
        private String userEmail;
        private String userName;
        private String guardianPublicKey;
        private String guardianPolynomial;
        private Integer sequenceOrder;
        private Boolean decryptedOrNot;
        private String partialDecryptedTally;
        private String proof;
        private Boolean isCurrentUser;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class VoterInfo {
        private String userEmail;
        private String userName;
        private Boolean hasVoted;
        private Boolean isCurrentUser;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ElectionChoiceInfo {
        private Long choiceId;
        private String optionTitle;
        private String optionDescription;
        private String partyName;
        private String candidatePic;
        private String partyPic;
        private Integer totalVotes;
    }
}
