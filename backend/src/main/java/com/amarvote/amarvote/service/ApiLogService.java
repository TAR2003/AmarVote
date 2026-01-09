package com.amarvote.amarvote.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.repository.ApiLogRepository;

@Service
public class ApiLogService {
    
    @Autowired
    private ApiLogRepository apiLogRepository;
    
    @Transactional
    public void saveLog(ApiLog log) {
        try {
            apiLogRepository.save(log);
        } catch (Exception e) {
            // Log the error but don't fail the request
            System.err.println("Failed to save API log: " + e.getMessage());
        }
    }
    
    public Page<ApiLog> getAllLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findAllByOrderByRequestTimeDesc(pageable);
    }
    
    public Page<ApiLog> getLogsByEmail(String email, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findByExtractedEmailOrderByRequestTimeDesc(email, pageable);
    }
    
    public Page<ApiLog> getLogsByIp(String ip, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return apiLogRepository.findByRequestIpOrderByRequestTimeDesc(ip, pageable);
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
}
