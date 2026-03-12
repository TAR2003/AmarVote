package com.amarvote.amarvote.dto;

import java.util.List;

import com.amarvote.amarvote.dto.CastBallotRequest.BotDetectionData;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateEncryptedBallotRequest {
    
    private Long electionId;
    private List<String> selectedCandidates;
    private BotDetectionData botDetection;
    
    /**
     * Padding field to ensure constant packet size regardless of candidate name length.
     * This prevents traffic analysis attacks that could infer voting patterns from packet sizes.
     */
    private String padding;
}