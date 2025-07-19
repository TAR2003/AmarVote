package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.Builder;

@Builder
public record ElectionGuardPartialDecryptionRequest(
    String guardian_id,
    String guardian_data,  // ✅ JSON string - NOT raw JSON object
    String private_key,    // ✅ JSON string - NOT raw JSON object
    String public_key,     // ✅ JSON string - NOT raw JSON object
    String polynomial,     // ✅ JSON string - NOT raw JSON object
    List<String> party_names,
    List<String> candidate_names,
    String ciphertext_tally,  // ✅ JSON string - NOT raw JSON object
    List<String> submitted_ballots,
    String joint_public_key,
    String commitment_hash,
    int number_of_guardians,
    int quorum
) {}
