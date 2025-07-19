package com.amarvote.amarvote.dto;

// ElectionGuardianSetupResponse.java

import java.util.List;

public record ElectionGuardianSetupResponse(
    String commitment_hash,
    List<String> polynomials,
    List<String> private_keys,
    List<String> public_keys,
    String joint_public_key,
    String manifest,
    String status,
    List<String> guardian_data  // ✅ Fixed: Now expects strings instead of Objects
) {}