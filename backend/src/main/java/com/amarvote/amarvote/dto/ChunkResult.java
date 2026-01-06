package com.amarvote.amarvote.dto;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChunkResult {
    private Long electionCenterId;
    private int chunkNumber;
    private Map<String, Integer> candidateVotes; // candidateName -> votes
    private List<String> ballotTrackingCodes;
    private List<String> ballotHashes;
}
