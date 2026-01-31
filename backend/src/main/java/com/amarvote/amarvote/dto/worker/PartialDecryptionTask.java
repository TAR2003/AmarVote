package com.amarvote.amarvote.dto.worker;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * Task message for partial decryption worker
 * Contains all information needed to process a single chunk of partial decryption
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartialDecryptionTask implements Serializable {    
    /**
     * Unique chunk identifier for tracking in the scheduler
     */
    private String chunkId;    
    private Long electionId;
    private Long electionCenterId; // The chunk to decrypt
    private int chunkNumber;
    
    // Guardian information
    private Long guardianId;
    private String guardianSequenceOrder;
    private String guardianPublicKey;
    private String decryptedPrivateKey;
    private String decryptedPolynomial;
    
    // Election metadata (cached)
    private List<String> candidateNames;
    private List<String> partyNames;
    private int numberOfGuardians;
    private String jointPublicKey;
    private String baseHash;
    private int quorum;
}
