package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuardianDecryptionProgressItem {
    private Long guardianId;
    private String guardianName;
    private String guardianEmail;
    private String profilePic;
    private Integer sequenceOrder;
    private Boolean decryptedOrNot;
    private String status;
    private String currentPhase;
    private Integer totalChunks;
    private Integer processedChunks;
    private Double progressPercentage;
}
