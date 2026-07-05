package com.amarvote.amarvote.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ScheduledElectionEmailRequest(
    @NotBlank(message = "Recipient group is required")
    String recipientGroup,

    @NotBlank(message = "Email body is required")
    String emailBody,

    @NotNull(message = "Scheduled time is required")
    Instant scheduledTime,

    String voterFilter
) {}
