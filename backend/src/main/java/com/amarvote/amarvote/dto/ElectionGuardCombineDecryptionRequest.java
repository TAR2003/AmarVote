package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.Builder;

@Builder
public record ElectionGuardCombineDecryptionRequest(
    List<String> party_names,
    List<String> candidate_names,
    String joint_public_key,
    String commitment_hash,
    Object ciphertext_tally,  // JSONB object
    List<String> submitted_ballots,
    List<String> guardian_public_keys,
    List<String> tally_shares,
    List<Object> ballot_shares  // JSONB objects array
) {}
