package com.amarvote.amarvote.dto.worker;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * Task message for compensated decryption worker
 * Contains all information needed to process a single compensated decryption share
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompensatedDecryptionTask implements Serializable {
    
    private Long electionId;
    private Long electionCenterId; // The chunk to process
    private int chunkNumber;
    
    // Source guardian (the one creating compensated shares)
    private Long sourceGuardianId;
    private String sourceGuardianSequenceOrder;
    private String sourceGuardianPublicKey;
    private String sourceGuardianKeyBackup; // Full guardian data with backups
    private String decryptedPrivateKey;
    private String decryptedPolynomial;
    
    // Target guardian (the one being compensated for)
    private Long targetGuardianId;
    private String targetGuardianSequenceOrder;
    private String targetGuardianPublicKey;
    private String targetGuardianKeyBackup; // Full guardian data
    
    // Election metadata (cached)
    private List<String> candidateNames;
    private List<String> partyNames;
    private int numberOfGuardians;
    private String jointPublicKey;
    private String baseHash;
    private int quorum;
}
