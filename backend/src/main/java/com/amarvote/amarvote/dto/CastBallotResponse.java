package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CastBallotResponse {
    
    private boolean success;
    private String message;
    private String hashCode;
    private String trackingCode;
    private String errorReason;
}
