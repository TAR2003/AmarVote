package com.amarvote.amarvote.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.ApiLogViewResponse;
import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.repository.ApiLogRepository;
import com.amarvote.amarvote.repository.ApiLogViewRepository;

@Service
public class ApiLogService {
    
    @Autowired
    private ApiLogRepository apiLogRepository;

    @Autowired
    private ApiLogViewRepository apiLogViewRepository;

    private static final int MAX_PAGE_SIZE = 200;

    @Value("${amarvote.api-logging.retention-days:90}")
    private int retentionDays;
    
    @Transactional
    public void saveLog(ApiLog log) {
        try {
            apiLogRepository.save(log);
        } catch (Exception e) {
            // Log the error but don't fail the request
            System.err.println("Failed to save API log: " + e.getMessage());
        }
    }

    /** Persists access logs off the request thread so DB writes do not compete with vote traffic. */
    @Async("apiLogExecutor")
    public void saveLogAsync(ApiLog log) {
        saveLog(log);
    }
    
    public Page<ApiLog> getAllLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, normalizePageSize(size));
        return apiLogRepository.findAllByOrderByRequestTimeDesc(pageable);
    }
    
    public Page<ApiLog> getLogsByEmail(String email, int page, int size) {
        Pageable pageable = PageRequest.of(page, normalizePageSize(size));
        return apiLogRepository.findByExtractedEmailContainingIgnoreCaseOrderByRequestTimeDesc(email, pageable);
    }
    
    public Page<ApiLog> getLogsByIp(String ip, int page, int size) {
        Pageable pageable = PageRequest.of(page, normalizePageSize(size));
        return apiLogRepository.findByRequestIpContainingOrderByRequestTimeDesc(ip, pageable);
    }
    
    public Page<ApiLog> getLogsByPath(String path, int page, int size) {
        Pageable pageable = PageRequest.of(page, normalizePageSize(size));
        return apiLogRepository.findByRequestPathContainingOrderByRequestTimeDesc(path, pageable);
    }

    public Page<?> getLogs(
            String view,
            int page,
            int size,
            String emailFilter,
            String ipFilter,
            String pathFilter) {
        int normalizedSize = normalizePageSize(size);
        int offset = page * normalizedSize;

        return switch (normalizeView(view)) {
            case "unique-email" -> getUniqueEmailPage(emailFilter, ipFilter, pathFilter, page, normalizedSize, offset);
            case "unique-ip" -> getUniqueIpPage(emailFilter, ipFilter, pathFilter, page, normalizedSize, offset);
            case "clusters" -> getClusterPage(emailFilter, ipFilter, pathFilter, page, normalizedSize, offset);
            default -> getDefaultLogsPage(emailFilter, ipFilter, pathFilter, page, normalizedSize);
        };
    }

    private Page<?> getDefaultLogsPage(
            String emailFilter, String ipFilter, String pathFilter, int page, int size) {
        if (emailFilter != null && !emailFilter.isBlank()) {
            return getLogsByEmail(emailFilter, page, size);
        }
        if (ipFilter != null && !ipFilter.isBlank()) {
            return getLogsByIp(ipFilter, page, size);
        }
        if (pathFilter != null && !pathFilter.isBlank()) {
            return getLogsByPath(pathFilter, page, size);
        }
        return getAllLogs(page, size);
    }

    private Page<ApiLogViewResponse> getUniqueEmailPage(
            String emailFilter, String ipFilter, String pathFilter, int page, int size, int offset) {
        long total = apiLogViewRepository.countUniqueEmails(emailFilter, ipFilter, pathFilter);
        List<ApiLogViewResponse> content = apiLogViewRepository
                .findUniqueEmails(emailFilter, ipFilter, pathFilter, size, offset)
                .stream()
                .map(this::mapRow)
                .toList();
        return new PageImpl<>(content, PageRequest.of(page, size), total);
    }

    private Page<ApiLogViewResponse> getUniqueIpPage(
            String emailFilter, String ipFilter, String pathFilter, int page, int size, int offset) {
        long total = apiLogViewRepository.countUniqueIps(emailFilter, ipFilter, pathFilter);
        List<ApiLogViewResponse> content = apiLogViewRepository
                .findUniqueIps(emailFilter, ipFilter, pathFilter, size, offset)
                .stream()
                .map(this::mapRow)
                .toList();
        return new PageImpl<>(content, PageRequest.of(page, size), total);
    }

    private Page<ApiLogViewResponse> getClusterPage(
            String emailFilter, String ipFilter, String pathFilter, int page, int size, int offset) {
        long total = apiLogViewRepository.countClusters(emailFilter, ipFilter, pathFilter);
        List<ApiLogViewResponse> content = apiLogViewRepository
                .findClusters(emailFilter, ipFilter, pathFilter, size, offset)
                .stream()
                .map(this::mapClusterRow)
                .toList();
        return new PageImpl<>(content, PageRequest.of(page, size), total);
    }

    private ApiLogViewResponse mapRow(Map<String, Object> row) {
        return ApiLogViewResponse.builder()
                .logId(asLong(row.get("log_id")))
                .requestMethod(asString(row.get("request_method")))
                .requestPath(asString(row.get("request_path")))
                .requestIp(asString(row.get("request_ip")))
                .extractedEmail(asString(row.get("extracted_email")))
                .responseStatus(asInteger(row.get("response_status")))
                .requestTime(asDateTime(row.get("request_time")))
                .responseTime(asLong(row.get("response_time")))
                .build();
    }

    private ApiLogViewResponse mapClusterRow(Map<String, Object> row) {
        Long clusterCount = asLong(row.get("cluster_count"));
        return mapRow(row).toBuilder()
                .clusterCount(clusterCount)
                .clusterStart(asDateTime(row.get("cluster_start")))
                .clusterEnd(asDateTime(row.get("cluster_end")))
                .isCluster(true)
                .build();
    }

    private String normalizeView(String view) {
        if (view == null || view.isBlank()) {
            return "all";
        }
        return view.trim().toLowerCase();
    }

    private int normalizePageSize(int size) {
        if (size < 1) {
            return 50;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    private Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(value.toString());
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(value.toString());
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private LocalDateTime asDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime dateTime) {
            return dateTime;
        }
        if (value instanceof java.sql.Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        return LocalDateTime.parse(value.toString());
    }
    
    public long getTotalLogs() {
        return apiLogRepository.count();
    }
    
    public long getErrorLogs() {
        return apiLogRepository.countErrorLogs();
    }

    @Transactional
    public int deleteLogsByIds(List<Long> logIds) {
        if (logIds == null || logIds.isEmpty()) {
            return 0;
        }
        List<Long> distinctIds = logIds.stream().distinct().toList();
        int deleted = 0;
        for (Long logId : distinctIds) {
            if (apiLogRepository.existsById(logId)) {
                apiLogRepository.deleteById(logId);
                deleted++;
            }
        }
        return deleted;
    }

    @Transactional
    public int scrubSensitiveFields() {
        return apiLogRepository.scrubSensitiveFields();
    }

    @Transactional
    public int purgeLogsOlderThanRetention() {
        if (retentionDays <= 0) {
            return 0;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        return apiLogRepository.deleteByRequestTimeBefore(cutoff);
    }
}
