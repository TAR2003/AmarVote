package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionResultsResponse {
    private boolean success;
    private String message;
    private Long electionId;
    private String electionTitle;
    private String status; // completed, decrypted
    
    // Individual chunk results
    private List<ChunkResultResponse> chunkResults;
    
    // Combined final results
    private Map<String, Integer> finalResults; // Candidate name -> total votes
    private Integer totalVotes;
    
    // All ballot information
    private List<BallotInfo> ballots;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BallotInfo {
        private String trackingCode;
        private String ballotHash;
        private Integer chunkNumber;
    }
}
