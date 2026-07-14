package com.amarvote.amarvote.dto.analytics;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AnalyticsLocationsResponse(
        String scope,
        @JsonProperty("scope_label") String scopeLabel,
        @JsonProperty("generated_at") String generatedAt,
        List<LocationPoint> locations,
        LocalBucket local,
        Summary summary) {

    public record LocationPoint(
            String ip,
            Double lat,
            Double lon,
            String city,
            String country,
            String region,
            String isp,
            long requests,
            @JsonProperty("unique_emails") long uniqueEmails,
            List<String> emails,
            @JsonProperty("last_seen") String lastSeen,
            @JsonProperty("failed_auth_count") long failedAuthCount,
            @JsonProperty("success_count") long successCount,
            @JsonProperty("verified_events") long verifiedEvents,
            @JsonProperty("avg_response_time_ms") long avgResponseTimeMs) {
    }

    public record LocalBucket(
            long requests,
            @JsonProperty("unique_emails") long uniqueEmails,
            List<String> emails,
            List<String> ips,
            @JsonProperty("last_seen") String lastSeen,
            @JsonProperty("failed_auth_count") long failedAuthCount,
            @JsonProperty("success_count") long successCount,
            @JsonProperty("verified_events") long verifiedEvents) {
    }

    public record Summary(
            @JsonProperty("total_locations") long totalLocations,
            @JsonProperty("total_requests") long totalRequests,
            @JsonProperty("active_clusters") long activeClusters,
            @JsonProperty("failed_auth_rate") double failedAuthRate,
            @JsonProperty("avg_response_time_ms") long avgResponseTimeMs) {
    }
}
