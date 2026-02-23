package com.amarvote.amarvote.dto;

// ElectionGuardianSetupResponse.java

import java.util.List;

public record ElectionGuardianSetupResponse(
    String commitment_hash,
    List<Object> polynomials,
    List<Object> private_keys,
    List<Object> public_keys,
    String joint_public_key,
    String manifest,
    String status,
    List<Object> guardian_data
) {}