package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.Builder;

@Builder
public record ElectionGuardPartialDecryptionRequest(
    String guardian_id,
    Object guardian_data,   // Must be Object (map) for msgpack to serialize as dict, not str
    Object private_key,     // Must be Object (map) for msgpack to serialize as dict, not str
    Object public_key,      // Must be Object (map) for msgpack to serialize as dict, not str
    Object polynomial,      // Must be Object (map) for msgpack to serialize as dict, not str
    List<String> party_names,
    List<String> candidate_names,
    Object ciphertext_tally,   // Must be Object (map) for msgpack to serialize as dict, not str
    List<Object> submitted_ballots, // Must be List<Object> for msgpack to serialize as list of dicts
    String joint_public_key,
    String commitment_hash,
    int number_of_guardians,
    int quorum
) {}
