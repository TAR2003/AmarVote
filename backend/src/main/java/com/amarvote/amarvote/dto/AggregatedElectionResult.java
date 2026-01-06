package com.amarvote.amarvote.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AggregatedElectionResult {
    private Long electionId;
    private Map<String, Integer> finalResults; // candidateName -> total votes
    private List<ChunkResult> chunkResults;
    private Instant tallyCompletedAt;
}
