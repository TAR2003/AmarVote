package com.amarvote.amarvote.repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class ApiLogViewRepository {

    private static final String CLUSTER_CTE = """
            WITH ordered_logs AS (
                SELECT
                    l.log_id,
                    LOWER(TRIM(COALESCE(l.extracted_email, ''))) AS email_key,
                    COALESCE(NULLIF(TRIM(l.request_ip), ''), 'unknown') AS ip_key,
                    l.request_time,
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
                    o.log_id,
                    o.email_key,
                    o.ip_key,
                    o.request_time,
                    CASE
                        WHEN o.prev_request_time IS NULL
                          OR o.request_time - o.prev_request_time > INTERVAL '30 minutes'
                        THEN 1 ELSE 0
                    END AS session_break
                FROM ordered_logs o
            ),
            session_numbered AS (
                SELECT
                    s.log_id,
                    s.email_key,
                    s.ip_key,
                    s.request_time,
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
                    (ARRAY_AGG(sn.log_id ORDER BY sn.request_time DESC))[1] AS latest_log_id
                FROM session_numbered sn
                GROUP BY sn.ip_key, sn.email_key, sn.cluster_id
            )
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public long countUniqueEmails(String emailFilter, String ipFilter, String pathFilter) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        String sql = """
                SELECT COUNT(*) FROM (
                    SELECT DISTINCT LOWER(TRIM(l.extracted_email))
                    FROM api_logs l
                    WHERE l.extracted_email IS NOT NULL AND TRIM(l.extracted_email) <> ''
                    %s
                ) t
                """.formatted(filter.sqlSuffix());
        return queryForLong(sql, filter.params());
    }

    public List<Map<String, Object>> findUniqueEmails(
            String emailFilter, String ipFilter, String pathFilter, int limit, int offset) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        Map<String, Object> params = new HashMap<>(filter.params());
        params.put("limit", limit);
        params.put("offset", offset);
        String sql = """
                SELECT
                    a.log_id,
                    a.request_method,
                    a.request_path,
                    a.request_ip,
                    a.extracted_email,
                    a.response_status,
                    a.request_time,
                    a.response_time
                FROM (
                    SELECT DISTINCT ON (LOWER(TRIM(l.extracted_email)))
                        l.log_id
                    FROM api_logs l
                    WHERE l.extracted_email IS NOT NULL AND TRIM(l.extracted_email) <> ''
                    %s
                    ORDER BY LOWER(TRIM(l.extracted_email)), l.request_time DESC
                ) latest
                JOIN api_logs a ON a.log_id = latest.log_id
                ORDER BY a.request_time DESC
                LIMIT :limit OFFSET :offset
                """.formatted(filter.sqlSuffix());
        return jdbc.queryForList(sql, params);
    }

    public long countUniqueIps(String emailFilter, String ipFilter, String pathFilter) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        String sql = """
                SELECT COUNT(*) FROM (
                    SELECT DISTINCT l.request_ip
                    FROM api_logs l
                    WHERE l.request_ip IS NOT NULL AND TRIM(l.request_ip) <> ''
                    %s
                ) t
                """.formatted(filter.sqlSuffix());
        return queryForLong(sql, filter.params());
    }

    public List<Map<String, Object>> findUniqueIps(
            String emailFilter, String ipFilter, String pathFilter, int limit, int offset) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        Map<String, Object> params = new HashMap<>(filter.params());
        params.put("limit", limit);
        params.put("offset", offset);
        String sql = """
                SELECT
                    a.log_id,
                    a.request_method,
                    a.request_path,
                    a.request_ip,
                    a.extracted_email,
                    a.response_status,
                    a.request_time,
                    a.response_time
                FROM (
                    SELECT DISTINCT ON (l.request_ip)
                        l.log_id
                    FROM api_logs l
                    WHERE l.request_ip IS NOT NULL AND TRIM(l.request_ip) <> ''
                    %s
                    ORDER BY l.request_ip, l.request_time DESC
                ) latest
                JOIN api_logs a ON a.log_id = latest.log_id
                ORDER BY a.request_time DESC
                LIMIT :limit OFFSET :offset
                """.formatted(filter.sqlSuffix());
        return jdbc.queryForList(sql, params);
    }

    public long countClusters(String emailFilter, String ipFilter, String pathFilter) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        String whereClause = filter.conditions().isEmpty() ? "" : "WHERE " + String.join(" AND ", filter.conditions());
        String sql = CLUSTER_CTE.formatted(whereClause) + "SELECT COUNT(*) FROM cluster_agg";
        return queryForLong(sql, filter.params());
    }

    public List<Map<String, Object>> findClusters(
            String emailFilter, String ipFilter, String pathFilter, int limit, int offset) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        Map<String, Object> params = new HashMap<>(filter.params());
        params.put("limit", limit);
        params.put("offset", offset);
        String whereClause = filter.conditions().isEmpty() ? "" : "WHERE " + String.join(" AND ", filter.conditions());
        String sql = CLUSTER_CTE.formatted(whereClause) + """
                SELECT
                    a.log_id,
                    a.request_method,
                    a.request_path,
                    a.request_ip,
                    a.extracted_email,
                    a.response_status,
                    a.request_time,
                    a.response_time,
                    c.cluster_count,
                    c.cluster_start,
                    c.cluster_end
                FROM cluster_agg c
                JOIN api_logs a ON a.log_id = c.latest_log_id
                ORDER BY c.cluster_end DESC
                LIMIT :limit OFFSET :offset
                """;
        return jdbc.queryForList(sql, params);
    }

    public List<Map<String, Object>> exportUniqueEmails(
            String emailFilter, String ipFilter, String pathFilter) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        String sql = """
                SELECT
                    a.log_id,
                    a.request_method,
                    a.request_path,
                    a.request_ip,
                    a.extracted_email,
                    a.response_status,
                    a.request_time,
                    a.response_time
                FROM (
                    SELECT DISTINCT ON (LOWER(TRIM(l.extracted_email)))
                        l.log_id
                    FROM api_logs l
                    WHERE l.extracted_email IS NOT NULL AND TRIM(l.extracted_email) <> ''
                    %s
                    ORDER BY LOWER(TRIM(l.extracted_email)), l.request_time DESC
                ) latest
                JOIN api_logs a ON a.log_id = latest.log_id
                ORDER BY a.request_time DESC
                """.formatted(filter.sqlSuffix());
        return jdbc.queryForList(sql, filter.params());
    }

    public List<Map<String, Object>> exportUniqueIps(
            String emailFilter, String ipFilter, String pathFilter) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        String sql = """
                SELECT
                    a.log_id,
                    a.request_method,
                    a.request_path,
                    a.request_ip,
                    a.extracted_email,
                    a.response_status,
                    a.request_time,
                    a.response_time
                FROM (
                    SELECT DISTINCT ON (l.request_ip)
                        l.log_id
                    FROM api_logs l
                    WHERE l.request_ip IS NOT NULL AND TRIM(l.request_ip) <> ''
                    %s
                    ORDER BY l.request_ip, l.request_time DESC
                ) latest
                JOIN api_logs a ON a.log_id = latest.log_id
                ORDER BY a.request_time DESC
                """.formatted(filter.sqlSuffix());
        return jdbc.queryForList(sql, filter.params());
    }

    public List<Map<String, Object>> exportClusters(
            String emailFilter, String ipFilter, String pathFilter) {
        FilterParts filter = buildFilterParts(emailFilter, ipFilter, pathFilter, "l");
        String whereClause = filter.conditions().isEmpty() ? "" : "WHERE " + String.join(" AND ", filter.conditions());
        String sql = CLUSTER_CTE.formatted(whereClause) + """
                SELECT
                    a.log_id,
                    a.request_method,
                    a.request_path,
                    a.request_ip,
                    a.extracted_email,
                    a.response_status,
                    a.request_time,
                    a.response_time,
                    c.cluster_count,
                    c.cluster_start,
                    c.cluster_end
                FROM cluster_agg c
                JOIN api_logs a ON a.log_id = c.latest_log_id
                ORDER BY c.cluster_end DESC
                """;
        return jdbc.queryForList(sql, filter.params());
    }

    public List<Map<String, Object>> findAllLogs(
            String emailFilter,
            String ipFilter,
            String pathFilter,
            String tab,
            String method,
            String statusCode,
            int limit,
            int offset) {
        ExportFilterParts filter = buildExportFilterParts(
                emailFilter, ipFilter, pathFilter, tab, method, statusCode, "l");
        Map<String, Object> params = new HashMap<>(filter.params());
        params.put("limit", limit);
        params.put("offset", offset);
        String sql = """
                SELECT
                    l.log_id,
                    l.request_method,
                    l.request_path,
                    l.request_ip,
                    l.extracted_email,
                    l.response_status,
                    l.request_time,
                    l.response_time
                FROM api_logs l
                %s
                ORDER BY l.request_time DESC
                LIMIT :limit OFFSET :offset
                """.formatted(filter.whereClause());
        return jdbc.queryForList(sql, params);
    }

    public long countAllLogs(
            String emailFilter,
            String ipFilter,
            String pathFilter,
            String tab,
            String method,
            String statusCode) {
        ExportFilterParts filter = buildExportFilterParts(
                emailFilter, ipFilter, pathFilter, tab, method, statusCode, "l");
        String sql = "SELECT COUNT(*) FROM api_logs l " + filter.whereClause();
        return queryForLong(sql, filter.params());
    }

    private long queryForLong(String sql, Map<String, Object> params) {
        Long value = jdbc.queryForObject(sql, params, Long.class);
        return value == null ? 0L : value;
    }

    private FilterParts buildFilterParts(String emailFilter, String ipFilter, String pathFilter, String alias) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        if (emailFilter != null && !emailFilter.isBlank()) {
            conditions.add("LOWER(" + alias + ".extracted_email) LIKE LOWER(:emailFilter)");
            params.put("emailFilter", "%" + emailFilter.trim() + "%");
        }
        if (ipFilter != null && !ipFilter.isBlank()) {
            conditions.add(alias + ".request_ip LIKE :ipFilter");
            params.put("ipFilter", "%" + ipFilter.trim() + "%");
        }
        if (pathFilter != null && !pathFilter.isBlank()) {
            conditions.add("LOWER(" + alias + ".request_path) LIKE LOWER(:pathFilter)");
            params.put("pathFilter", "%" + pathFilter.trim() + "%");
        }

        return new FilterParts(conditions, params);
    }

    private ExportFilterParts buildExportFilterParts(
            String emailFilter,
            String ipFilter,
            String pathFilter,
            String tab,
            String method,
            String statusCode,
            String alias) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        if (emailFilter != null && !emailFilter.isBlank()) {
            conditions.add("LOWER(" + alias + ".extracted_email) LIKE LOWER(:emailFilter)");
            params.put("emailFilter", "%" + emailFilter.trim() + "%");
        }
        if (ipFilter != null && !ipFilter.isBlank()) {
            conditions.add(alias + ".request_ip LIKE :ipFilter");
            params.put("ipFilter", "%" + ipFilter.trim() + "%");
        }
        if (pathFilter != null && !pathFilter.isBlank()) {
            conditions.add("LOWER(" + alias + ".request_path) LIKE LOWER(:pathFilter)");
            params.put("pathFilter", "%" + pathFilter.trim() + "%");
        }
        if (method != null && !method.isBlank()) {
            conditions.add(alias + ".request_method = :method");
            params.put("method", method.trim().toUpperCase());
        }
        if (statusCode != null && !statusCode.isBlank()) {
            conditions.add(alias + ".response_status = :statusCode");
            params.put("statusCode", Integer.parseInt(statusCode.trim()));
        }

        String normalizedTab = tab == null ? "all" : tab.trim().toLowerCase();
        switch (normalizedTab) {
            case "authenticated" -> conditions.add(
                    alias + ".extracted_email IS NOT NULL AND TRIM(" + alias + ".extracted_email) <> ''");
            case "anonymous" -> conditions.add(
                    "(" + alias + ".extracted_email IS NULL OR TRIM(" + alias + ".extracted_email) = '')");
            case "invalid" -> conditions.add(alias + ".response_status IN (401, 403)");
            default -> { /* all */ }
        }

        return new ExportFilterParts(conditions, params);
    }

    private record FilterParts(List<String> conditions, Map<String, Object> params) {
        String sqlSuffix() {
            if (conditions.isEmpty()) {
                return "";
            }
            return "AND " + String.join(" AND ", conditions);
        }
    }

    private record ExportFilterParts(List<String> conditions, Map<String, Object> params) {
        String whereClause() {
            if (conditions.isEmpty()) {
                return "";
            }
            return "WHERE " + String.join(" AND ", conditions);
        }
    }
}
