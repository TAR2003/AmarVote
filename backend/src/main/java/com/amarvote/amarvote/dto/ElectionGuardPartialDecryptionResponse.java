package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record ElectionGuardPartialDecryptionResponse(
    String ballot_shares,  // ✅ JSON string - NOT raw JSON object
    String guardian_public_key,
    String status,
    String tally_share  // ✅ JSON string - NOT raw JSON object
) {}

