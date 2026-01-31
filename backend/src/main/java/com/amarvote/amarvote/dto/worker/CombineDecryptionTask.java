package com.amarvote.amarvote.dto.worker;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * Task message for combine decryption shares worker
 * Contains all information needed to process a single chunk of combining decryption shares
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CombineDecryptionTask implements Serializable {    
    /**
     * Unique chunk identifier for tracking in the scheduler
     */
    private String chunkId;    
    private Long electionId;
    private Long electionCenterId; // The chunk to combine
    private int chunkNumber;
    
    // Election metadata (cached)
    private List<String> candidateNames;
    private List<String> partyNames;
    private int numberOfGuardians;
    private String jointPublicKey;
    private String baseHash;
    private int quorum;
}
