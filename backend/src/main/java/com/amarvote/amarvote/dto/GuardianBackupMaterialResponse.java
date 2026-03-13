package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record GuardianBackupMaterialResponse(
    Long electionId,
    String guardianId,
    Integer sequenceOrder,
    String guardianPublicKey,
    String guardianPrivateKey,
    String guardianPolynomial
) {}
