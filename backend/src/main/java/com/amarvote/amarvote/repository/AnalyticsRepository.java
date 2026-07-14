package com.amarvote.amarvote.repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * Read-only aggregations over api_logs for the User Analytics feature.
 * Does not write to or alter api_logs.
 */
@Repository
@RequiredArgsConstructor
public class AnalyticsRepository {

    /**
     * Verified crypto/auth paths — Aurora Teal markers only.
     * MFA verify requires HTTP 200; other paths count regardless of status.
     */
    public static final String VERIFIED_PREDICATE = """
            (
                l.request_path LIKE '/api/cast-encrypted-ballot%'
                OR l.request_path LIKE '/api/guardian/key-ceremony/%'
                OR l.request_path LIKE '/api/key-ceremony/status/%'
                OR (l.request_path LIKE '/api/auth/mfa/verify%' AND l.response_status = 200)
            )
            """;

    public static final String FAILED_AUTH_PREDICATE = "l.response_status IN (401, 403)";

    private final NamedParameterJdbcTemplate jdbc;

    public List<Map<String, Object>> aggregateByIp(Instant sinceInclusive, Instant untilExclusive) {
        Map<String, Object> params = new HashMap<>();
        String timeFilter = buildWhereClause(params, sinceInclusive, untilExclusive, null);
        String sql = """
                SELECT
                    COALESCE(NULLIF(TRIM(l.request_ip), ''), 'unknown') AS ip,
                    COUNT(*)::bigint AS requests,
                    COUNT(DISTINCT CASE
                        WHEN l.extracted_email IS NOT NULL AND TRIM(l.extracted_email) <> ''
                        THEN LOWER(TRIM(l.extracted_email))
                    END)::bigint AS unique_emails,
                    ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE
                        WHEN l.extracted_email IS NOT NULL AND TRIM(l.extracted_email) <> ''
                        THEN LOWER(TRIM(l.extracted_email))
                    END), NULL) AS emails,
                    MAX(l.request_time) AS last_seen,
                    COUNT(*) FILTER (WHERE %s)::bigint AS failed_auth_count,
                    COUNT(*) FILTER (WHERE %s)::bigint AS verified_events,
                    COALESCE(AVG(l.response_time), 0)::bigint AS avg_response_time_ms
                FROM api_logs l
                %s
                GROUP BY COALESCE(NULLIF(TRIM(l.request_ip), ''), 'unknown')
                ORDER BY requests DESC
                """.formatted(
                        FAILED_AUTH_PREDICATE,
                        VERIFIED_PREDICATE.replace("%", "%%"),
                        timeFilter);
        return jdbc.queryForList(sql, params);
    }

    public List<Map<String, Object>> timeseries(
            Instant sinceInclusive,
            Instant untilExclusive,
            boolean hourly,
            String ipFilter) {
        Map<String, Object> params = new HashMap<>();
        String whereClause = buildWhereClause(params, sinceInclusive, untilExclusive, ipFilter);
        String trunc = hourly ? "hour" : "day";
        String sql = """
                SELECT
                    date_trunc('%s', l.request_time) AS bucket,
                    COUNT(*)::bigint AS requests,
                    COUNT(*) FILTER (WHERE %s)::bigint AS verified_events
                FROM api_logs l
                %s
                GROUP BY bucket
                ORDER BY bucket ASC
                """.formatted(trunc, VERIFIED_PREDICATE.replace("%", "%%"), whereClause);
        return jdbc.queryForList(sql, params);
    }

    public List<Map<String, Object>> findSessions(Instant sinceInclusive, Instant untilExclusive) {
        Map<String, Object> params = new HashMap<>();
        String whereClause = buildWhereClause(params, sinceInclusive, untilExclusive, null);
        String sql = buildClusterCte(whereClause) + """
                SELECT
                    c.ip_key AS ip,
                    CASE
                        WHEN c.email_key IS NULL OR c.email_key = '' THEN 'Anonymous'
                        ELSE c.email_key
                    END AS email,
                    c.cluster_count,
                    c.cluster_start,
                    c.cluster_end,
                    c.ember_count,
                    c.teal_count,
                    c.violet_count
                FROM cluster_agg c
                ORDER BY c.cluster_end DESC
                LIMIT 2000
                """;
        return jdbc.queryForList(sql, params);
    }

    public long countActiveClusters(Instant sinceInclusive, Instant untilExclusive) {
        Map<String, Object> params = new HashMap<>();
        String whereClause = buildWhereClause(params, sinceInclusive, untilExclusive, null);
        String sql = buildClusterCte(whereClause) + "SELECT COUNT(*) FROM cluster_agg";
        Long value = jdbc.queryForObject(sql, params, Long.class);
        return value == null ? 0L : value;
    }

    public Map<String, Object> summaryTotals(Instant sinceInclusive, Instant untilExclusive) {
        Map<String, Object> params = new HashMap<>();
        String timeFilter = buildWhereClause(params, sinceInclusive, untilExclusive, null);
        String sql = """
                SELECT
                    COUNT(*)::bigint AS total_requests,
                    COUNT(*) FILTER (WHERE %s)::bigint AS failed_auth_count,
                    COALESCE(AVG(l.response_time), 0)::bigint AS avg_response_time_ms
                FROM api_logs l
                %s
                """.formatted(FAILED_AUTH_PREDICATE, timeFilter);
        List<Map<String, Object>> rows = jdbc.queryForList(sql, params);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    private static String buildWhereClause(
            Map<String, Object> params,
            Instant sinceInclusive,
            Instant untilExclusive,
            String ipFilter) {
        List<String> conditions = new ArrayList<>();
        if (sinceInclusive != null) {
            conditions.add("l.request_time >= :since");
            params.put("since", Timestamp.from(sinceInclusive));
        }
        if (untilExclusive != null) {
            conditions.add("l.request_time < :until");
            params.put("until", Timestamp.from(untilExclusive));
        }
        if (ipFilter != null && !ipFilter.isBlank()) {
            conditions.add("COALESCE(NULLIF(TRIM(l.request_ip), ''), 'unknown') = :ipFilter");
            params.put("ipFilter", ipFilter.trim());
        }
        if (conditions.isEmpty()) {
            return "";
        }
        return "WHERE " + String.join(" AND ", conditions);
    }

    private static String buildClusterCte(String whereClause) {
        // Mutually exclusive status mix for the sessions table legend:
        // ember = failed auth, teal = verified and not failed, violet = remaining.
        return """
                WITH ordered_logs AS (
                    SELECT
                        l.log_id,
                        LOWER(TRIM(COALESCE(l.extracted_email, ''))) AS email_key,
                        COALESCE(NULLIF(TRIM(l.request_ip), ''), 'unknown') AS ip_key,
                        l.request_time,
                        l.response_status,
                        l.request_path,
                        LAG(l.request_time) OVER (
                            PARTITION BY COALESCE(NULLIF(TRIM(l.request_ip), ''), 'unknown'),
                                         LOWER(TRIM(COALESCE(l.extracted_email, '')))
                            ORDER BY l.request_time
                        ) AS prev_request_time
                    FROM api_logs l
                    %s
                ),
                session_marked AS (
                    SELECT
                        o.*,
                        CASE
                            WHEN o.prev_request_time IS NULL
                              OR o.request_time - o.prev_request_time > INTERVAL '30 minutes'
                            THEN 1 ELSE 0
                        END AS session_break
                    FROM ordered_logs o
                ),
                session_numbered AS (
                    SELECT
                        s.*,
                        SUM(s.session_break) OVER (
                            PARTITION BY s.ip_key, s.email_key
                            ORDER BY s.request_time
                            ROWS UNBOUNDED PRECEDING
                        ) AS cluster_id
                    FROM session_marked s
                ),
                cluster_agg AS (
                    SELECT
                        sn.ip_key,
                        sn.email_key,
                        sn.cluster_id,
                        COUNT(*)::bigint AS cluster_count,
                        MIN(sn.request_time) AS cluster_start,
                        MAX(sn.request_time) AS cluster_end,
                        COUNT(*) FILTER (WHERE sn.response_status IN (401, 403))::bigint AS ember_count,
                        COUNT(*) FILTER (WHERE
                            sn.response_status NOT IN (401, 403)
                            AND (
                                sn.request_path LIKE '/api/cast-encrypted-ballot%%'
                                OR sn.request_path LIKE '/api/guardian/key-ceremony/%%'
                                OR sn.request_path LIKE '/api/key-ceremony/status/%%'
                                OR (sn.request_path LIKE '/api/auth/mfa/verify%%' AND sn.response_status = 200)
                            )
                        )::bigint AS teal_count,
                        COUNT(*) FILTER (WHERE
                            sn.response_status NOT IN (401, 403)
                            AND NOT (
                                sn.request_path LIKE '/api/cast-encrypted-ballot%%'
                                OR sn.request_path LIKE '/api/guardian/key-ceremony/%%'
                                OR sn.request_path LIKE '/api/key-ceremony/status/%%'
                                OR (sn.request_path LIKE '/api/auth/mfa/verify%%' AND sn.response_status = 200)
                            )
                        )::bigint AS violet_count
                    FROM session_numbered sn
                    GROUP BY sn.ip_key, sn.email_key, sn.cluster_id
                )
                """.formatted(whereClause);
    }
}
