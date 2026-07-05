package com.amarvote.amarvote.dto;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduledElectionEmailResponse {
    private Long emailId;
    private Long electionId;
    private String recipientGroup;
    private String voterFilter;
    private String emailBody;
    private Instant scheduledTime;
    private Boolean sent;
    private Instant sentAt;
    private Instant createdAt;
}
