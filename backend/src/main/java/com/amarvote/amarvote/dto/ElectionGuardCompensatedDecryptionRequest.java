package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.Builder;

@Builder
public record ElectionGuardCompensatedDecryptionRequest(
    String available_guardian_id,
    String missing_guardian_id,
    Object available_guardian_data,  // Must be Object (map) for msgpack to serialize as dict
    Object missing_guardian_data,    // Must be Object (map) for msgpack to serialize as dict
    Object available_private_key,    // Must be Object (map) for msgpack to serialize as dict
    Object available_public_key,     // Must be Object (map) for msgpack to serialize as dict
    Object available_polynomial,     // Must be Object (map) for msgpack to serialize as dict
    List<String> party_names,
    List<String> candidate_names,
    Object ciphertext_tally,         // Must be Object (map) for msgpack to serialize as dict
    List<Object> submitted_ballots,  // Must be List<Object> for msgpack to serialize as list of dicts
    String joint_public_key,
    String commitment_hash,
    int number_of_guardians,
    int quorum
) {}
