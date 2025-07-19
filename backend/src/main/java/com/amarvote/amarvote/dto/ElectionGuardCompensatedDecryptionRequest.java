package com.amarvote.amarvote.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonRawValue;

import lombok.Builder;

@Builder
public record ElectionGuardCompensatedDecryptionRequest(
    String available_guardian_id,
    String missing_guardian_id,
    @JsonRawValue String available_guardian_data,  // ✅ Raw JSON - prevents double escaping
    @JsonRawValue String missing_guardian_data,    // ✅ Raw JSON - prevents double escaping
    @JsonRawValue String available_private_key,    // ✅ Raw JSON - prevents double escaping
    @JsonRawValue String available_public_key,     // ✅ Raw JSON - prevents double escaping
    @JsonRawValue String available_polynomial,     // ✅ Raw JSON - prevents double escaping
    List<String> party_names,
    List<String> candidate_names,
    @JsonRawValue String ciphertext_tally,         // ✅ Raw JSON - prevents double escaping
    List<String> submitted_ballots,
    String joint_public_key,
    String commitment_hash,
    int number_of_guardians,
    int quorum
) {}
