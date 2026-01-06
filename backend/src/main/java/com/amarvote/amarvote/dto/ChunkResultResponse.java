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
public class ChunkResultResponse {
    private Long electionCenterId;
    private Integer chunkNumber;
    private Map<String, Integer> candidateVotes; // Candidate name -> votes in this chunk
    private List<String> trackingCodes;
    private List<String> ballotHashes;
}
