package com.amarvote.amarvote.dto.analytics;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AnalyticsTimeseriesResponse(
        String scope,
        @JsonProperty("scope_label") String scopeLabel,
        @JsonProperty("generated_at") String generatedAt,
        List<Bucket> buckets) {

    public record Bucket(
            String t,
            long requests,
            @JsonProperty("verified_events") long verifiedEvents) {
    }
}
