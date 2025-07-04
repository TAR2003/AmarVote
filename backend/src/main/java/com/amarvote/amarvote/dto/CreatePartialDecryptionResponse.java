package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record CreatePartialDecryptionResponse(
    boolean success,
    String message
) {}
