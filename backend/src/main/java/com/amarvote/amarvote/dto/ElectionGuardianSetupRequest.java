package com.amarvote.amarvote.dto;

// ElectionGuardianSetupRequest.java

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

public record ElectionGuardianSetupRequest(
    @Min(1) int number_of_guardians,
    @Min(1) int quorum,
    @NotEmpty List<String> party_names,
    @NotEmpty List<String> candidate_names
) {
}