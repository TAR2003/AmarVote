package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.Builder;

@Builder
public record ElectionGuardPartialDecryptionRequest(
    String guardian_id,
    int sequence_order,
    String guardian_public_key,
    String guardian_private_key,
    String guardian_polynomial,
    List<String> party_names,
    List<String> candidate_names,
    Object ciphertext_tally,  // Changed from String to Object to handle JSON
    String status,
    List<String> submitted_ballots,
    String joint_public_key,
    String commitment_hash,
    int number_of_guardians
) {}
