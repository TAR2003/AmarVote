package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record ElectionGuardCompensatedDecryptionResponse(
    String status,
    Object compensated_tally_share,    // Object - microservice returns dict
    Object compensated_ballot_shares,  // Object - microservice returns dict
    String message
) {}
