package com.amarvote.amarvote.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.repository.ApiLogRepository;

@Service
public class ApiLogService {
    
    @Autowired
    private ApiLogRepository apiLogRepository;

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
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findAllByOrderByRequestTimeDesc(pageable);
    }
    
    public Page<ApiLog> getLogsByEmail(String email, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findByExtractedEmailContainingIgnoreCaseOrderByRequestTimeDesc(email, pageable);
    }
    
    public Page<ApiLog> getLogsByIp(String ip, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findByRequestIpContainingOrderByRequestTimeDesc(ip, pageable);
    }
    
    public Page<ApiLog> getLogsByPath(String path, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findByRequestPathContainingOrderByRequestTimeDesc(path, pageable);
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
