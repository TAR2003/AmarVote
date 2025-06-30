package com.amarvote.amarvote.dto;

// ElectionGuardianSetupResponse.java

import java.util.List;

public record ElectionGuardianSetupResponse(
    String commitment_hash,
    List<String> guardian_polynomials,
    List<String> guardian_private_keys,
    List<String> guardian_public_keys,
    String joint_public_key,
    String manifest,
    String status
) {}