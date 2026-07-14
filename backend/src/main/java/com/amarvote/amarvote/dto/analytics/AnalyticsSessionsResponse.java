package com.amarvote.amarvote.dto.analytics;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AnalyticsSessionsResponse(
        String scope,
        @JsonProperty("scope_label") String scopeLabel,
        @JsonProperty("generated_at") String generatedAt,
        List<SessionRow> sessions) {

    public record SessionRow(
            String ip,
            String city,
            String country,
            boolean local,
            String email,
            @JsonProperty("cluster_requests") long clusterRequests,
            @JsonProperty("cluster_started") String clusterStarted,
            @JsonProperty("cluster_ended") String clusterEnded,
            @JsonProperty("cluster_duration_seconds") long clusterDurationSeconds,
            @JsonProperty("violet_count") long violetCount,
            @JsonProperty("ember_count") long emberCount,
            @JsonProperty("teal_count") long tealCount) {
    }
}
