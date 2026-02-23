package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record ElectionGuardPartialDecryptionResponse(
    Object ballot_shares,       // Object - microservice returns dict
    String guardian_public_key,
    String status,
    Object tally_share          // Object - microservice returns dict
) {}

