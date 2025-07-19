package com.amarvote.amarvote.dto;

import com.fasterxml.jackson.annotation.JsonRawValue;

import lombok.Builder;

@Builder
public record ElectionGuardCompensatedDecryptionResponse(
    String status,
    @JsonRawValue String compensated_tally_share,    // ✅ Raw JSON - prevents double escaping
    @JsonRawValue String compensated_ballot_shares,  // ✅ Raw JSON - prevents double escaping
    String message
) {}
