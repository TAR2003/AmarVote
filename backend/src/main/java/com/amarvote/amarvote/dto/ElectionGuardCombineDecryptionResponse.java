package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record ElectionGuardCombineDecryptionResponse(
    String status,
    Object results,
    String message
) {}
