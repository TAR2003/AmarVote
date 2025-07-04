package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record ElectionGuardPartialDecryptionResponse(
    Object ballot_shares,  // Changed from String to Object to handle JSON dictionary
    String guardian_public_key,
    String status,
    String tally_share
) {}
