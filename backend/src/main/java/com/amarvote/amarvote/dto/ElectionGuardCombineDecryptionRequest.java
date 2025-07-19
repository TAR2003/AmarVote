package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.Builder;

@Builder
public record ElectionGuardCombineDecryptionRequest(
    List<String> party_names,
    List<String> candidate_names,
    String joint_public_key,
    String commitment_hash,
    String ciphertext_tally,  // ✅ JSON string - NOT raw JSON object
    List<String> submitted_ballots,
    List<String> guardian_public_keys,
    List<String> tally_shares,  // ✅ JSON strings in list
    List<String> ballot_shares,  // ✅ JSON strings in list
    int number_of_guardians,
    int quorum
) {}
