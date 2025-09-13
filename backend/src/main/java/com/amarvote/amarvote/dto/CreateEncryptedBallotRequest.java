package com.amarvote.amarvote.dto;

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
    private String selectedCandidate;
    private BotDetectionData botDetection;
}