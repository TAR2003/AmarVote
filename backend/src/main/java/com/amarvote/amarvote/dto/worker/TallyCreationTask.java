package com.amarvote.amarvote.dto.worker;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * Task message for tally creation worker
 * Contains all information needed to process a single chunk of ballots
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TallyCreationTask implements Serializable {
    
    private Long electionId;
    private int chunkNumber;
    private List<Long> ballotIds; // IDs of ballots to process in this chunk
    
    // Election metadata (cached to avoid repeated DB queries)
    private List<String> partyNames;
    private List<String> candidateNames;
    private String jointPublicKey;
    private String baseHash;
    private int quorum;
    private int numberOfGuardians;
}
