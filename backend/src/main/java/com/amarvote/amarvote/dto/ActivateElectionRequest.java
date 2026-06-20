package com.amarvote.amarvote.dto;

import java.time.Instant;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;

public record ActivateElectionRequest(
    @NotNull(message = "Election ID is required")
    Long electionId,

    @NotNull(message = "Starting time is required")
    @Future(message = "Starting time must be in the future")
    Instant startingTime,

    @NotNull(message = "Ending time is required")
    @Future(message = "Ending time must be in the future")
    Instant endingTime
) {}
