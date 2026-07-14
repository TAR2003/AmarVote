package com.amarvote.amarvote.service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.analytics.AnalyticsLocationsResponse;
import com.amarvote.amarvote.dto.analytics.AnalyticsLocationsResponse.LocalBucket;
import com.amarvote.amarvote.dto.analytics.AnalyticsLocationsResponse.LocationPoint;
import com.amarvote.amarvote.dto.analytics.AnalyticsLocationsResponse.Summary;
import com.amarvote.amarvote.dto.analytics.AnalyticsSessionsResponse;
import com.amarvote.amarvote.dto.analytics.AnalyticsSessionsResponse.SessionRow;
import com.amarvote.amarvote.dto.analytics.AnalyticsTimeseriesResponse;
import com.amarvote.amarvote.dto.analytics.AnalyticsTimeseriesResponse.Bucket;
import com.amarvote.amarvote.geo.GeoLocation;
import com.amarvote.amarvote.geo.IpGeoResolver;
import com.amarvote.amarvote.geo.PrivateIpDetector;
import com.amarvote.amarvote.repository.AnalyticsRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private static final DateTimeFormatter ISO_INSTANT = DateTimeFormatter.ISO_INSTANT;
    private static final ZoneId ANALYTICS_ZONE = ZoneId.systemDefault();

    private final AnalyticsRepository analyticsRepository;
    private final IpGeoResolver ipGeoResolver;

    public AnalyticsLocationsResponse getLocations(String scope) {
        ScopeContext ctx = resolveScope(scope);
        List<Map<String, Object>> rows = analyticsRepository.aggregateByIp(ctx.since());
        Map<String, Object> totals = analyticsRepository.summaryTotals(ctx.since());
        long activeClusters = analyticsRepository.countActiveClusters(ctx.since());

        Set<String> publicIps = rows.stream()
                .map(r -> asString(r.get("ip")))
                .filter(Objects::nonNull)
                .filter(ip -> !PrivateIpDetector.isPrivateOrReserved(ip))
                .collect(Collectors.toCollection(HashSet::new));

        Map<String, GeoLocation> geoMap = ipGeoResolver.resolveAll(publicIps);

        List<LocationPoint> locations = new ArrayList<>();
        long localRequests = 0;
        long localUniqueEmails = 0;
        long localFailed = 0;
        long localSuccess = 0;
        long localVerified = 0;
        String localLastSeen = null;
        List<String> localEmails = new ArrayList<>();
        List<String> localIps = new ArrayList<>();
        Set<String> localEmailSet = new HashSet<>();

        for (Map<String, Object> row : rows) {
            String ip = asString(row.get("ip"));
            long requests = asLong(row.get("requests"));
            long uniqueEmails = asLong(row.get("unique_emails"));
            long failed = asLong(row.get("failed_auth_count"));
            long verified = asLong(row.get("verified_events"));
            long success = Math.max(requests - failed, 0);
            long avgRt = asLong(row.get("avg_response_time_ms"));
            List<String> emails = asStringList(row.get("emails"));
            String lastSeen = formatTimestamp(row.get("last_seen"));

            if (PrivateIpDetector.isPrivateOrReserved(ip)) {
                localRequests += requests;
                localFailed += failed;
                localSuccess += success;
                localVerified += verified;
                localIps.add(ip == null ? "unknown" : ip);
                for (String email : emails) {
                    if (localEmailSet.add(email.toLowerCase())) {
                        localEmails.add(email);
                    }
                }
                localUniqueEmails = localEmailSet.size();
                if (localLastSeen == null || (lastSeen != null && lastSeen.compareTo(localLastSeen) > 0)) {
                    localLastSeen = lastSeen;
                }
                continue;
            }

            GeoLocation geo = geoMap.getOrDefault(ip, GeoLocation.ofUnknown(ip));
            locations.add(new LocationPoint(
                    ip,
                    geo.lat(),
                    geo.lon(),
                    geo.city(),
                    geo.country(),
                    requests,
                    uniqueEmails,
                    emails,
                    lastSeen,
                    failed,
                    success,
                    verified,
                    avgRt));
        }

        long totalRequests = asLong(totals.get("total_requests"));
        long failedAuthCount = asLong(totals.get("failed_auth_count"));
        long avgResponseTimeMs = asLong(totals.get("avg_response_time_ms"));
        double failedAuthRate = totalRequests == 0 ? 0.0
                : Math.round((failedAuthCount * 10000.0) / totalRequests) / 10000.0;

        Summary summary = new Summary(
                locations.size(),
                totalRequests,
                activeClusters,
                failedAuthRate,
                avgResponseTimeMs);

        LocalBucket local = new LocalBucket(
                localRequests,
                localUniqueEmails,
                localEmails,
                localIps,
                localLastSeen,
                localFailed,
                localSuccess,
                localVerified);

        return new AnalyticsLocationsResponse(
                ctx.scope(),
                ctx.scopeLabel(),
                Instant.now().toString(),
                locations,
                local,
                summary);
    }

    public AnalyticsTimeseriesResponse getTimeseries(String scope, String ipFilter) {
        ScopeContext ctx = resolveScope(scope);
        boolean hourly = "today".equals(ctx.scope());
        List<Map<String, Object>> rows = analyticsRepository.timeseries(ctx.since(), hourly, ipFilter);

        List<Bucket> buckets = rows.stream()
                .map(row -> new Bucket(
                        formatTimestamp(row.get("bucket")),
                        asLong(row.get("requests")),
                        asLong(row.get("verified_events"))))
                .toList();

        return new AnalyticsTimeseriesResponse(
                ctx.scope(),
                ctx.scopeLabel(),
                Instant.now().toString(),
                buckets);
    }

    public AnalyticsSessionsResponse getSessions(String scope) {
        ScopeContext ctx = resolveScope(scope);
        List<Map<String, Object>> rows = analyticsRepository.findSessions(ctx.since());

        Set<String> publicIps = rows.stream()
                .map(r -> asString(r.get("ip")))
                .filter(Objects::nonNull)
                .filter(ip -> !PrivateIpDetector.isPrivateOrReserved(ip))
                .collect(Collectors.toCollection(HashSet::new));
        Map<String, GeoLocation> geoMap = ipGeoResolver.resolveAll(publicIps);

        List<SessionRow> sessions = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String ip = asString(row.get("ip"));
            boolean local = PrivateIpDetector.isPrivateOrReserved(ip);
            GeoLocation geo = local
                    ? GeoLocation.ofLocal()
                    : geoMap.getOrDefault(ip, GeoLocation.ofUnknown(ip));

            Instant start = asInstant(row.get("cluster_start"));
            Instant end = asInstant(row.get("cluster_end"));
            long durationSeconds = (start != null && end != null)
                    ? Math.max(Duration.between(start, end).getSeconds(), 0)
                    : 0;

            sessions.add(new SessionRow(
                    ip,
                    geo.city(),
                    geo.country(),
                    local || geo.local(),
                    asString(row.get("email")),
                    asLong(row.get("cluster_count")),
                    formatTimestamp(row.get("cluster_start")),
                    formatTimestamp(row.get("cluster_end")),
                    durationSeconds,
                    asLong(row.get("violet_count")),
                    asLong(row.get("ember_count")),
                    asLong(row.get("teal_count"))));
        }

        return new AnalyticsSessionsResponse(
                ctx.scope(),
                ctx.scopeLabel(),
                Instant.now().toString(),
                sessions);
    }

    private ScopeContext resolveScope(String scopeRaw) {
        String scope = scopeRaw == null ? "today" : scopeRaw.trim().toLowerCase();
        if (!"all".equals(scope)) {
            scope = "today";
        }
        if ("today".equals(scope)) {
            Instant since = LocalDate.now(ANALYTICS_ZONE)
                    .atStartOfDay(ANALYTICS_ZONE)
                    .toInstant();
            String label = "Today (" + ANALYTICS_ZONE.getId() + ")";
            return new ScopeContext(scope, label, since);
        }
        return new ScopeContext("all", "All Time", null);
    }

    private static String formatTimestamp(Object value) {
        Instant instant = asInstant(value);
        return instant == null ? null : ISO_INSTANT.format(instant);
    }

    private static Instant asInstant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant();
        }
        if (value instanceof java.time.LocalDateTime ldt) {
            return ldt.atZone(ANALYTICS_ZONE).toInstant();
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant();
        }
        return null;
    }

    private static long asLong(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    @SuppressWarnings("unchecked")
    private static List<String> asStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return list.stream()
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .filter(s -> !s.isBlank())
                    .toList();
        }
        if (value instanceof String[] array) {
            return Arrays.stream(array).filter(Objects::nonNull).filter(s -> !s.isBlank()).toList();
        }
        if (value instanceof java.sql.Array sqlArray) {
            try {
                Object raw = sqlArray.getArray();
                if (raw instanceof Object[] objects) {
                    return Arrays.stream(objects)
                            .filter(Objects::nonNull)
                            .map(Object::toString)
                            .filter(s -> !s.isBlank())
                            .toList();
                }
            } catch (Exception ignored) {
                return List.of();
            }
        }
        return List.of();
    }

    private record ScopeContext(String scope, String scopeLabel, Instant since) {
    }
}
