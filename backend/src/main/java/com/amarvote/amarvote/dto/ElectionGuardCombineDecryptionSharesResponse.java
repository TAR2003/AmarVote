package com.amarvote.amarvote.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Builder;

@Builder
public record ElectionGuardCombineDecryptionSharesResponse(
        @JsonProperty("status") String status,
        @JsonProperty("results") Object results  // Object - microservice returns dict
) {
}
