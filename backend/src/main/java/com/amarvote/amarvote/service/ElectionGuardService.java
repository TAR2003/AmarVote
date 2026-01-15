package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.io.HttpClientConnectionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class ElectionGuardService {

    private static final Logger log = LoggerFactory.getLogger(ElectionGuardService.class);
    private static final AtomicLong requestCounter = new AtomicLong(0);

    @Autowired
    @Qualifier("electionGuardRestTemplate")
    private RestTemplate restTemplate;

    @Value("${electionguard.base.url:http://electionguard:5000}")
    private String baseUrl;

    /**
     * Generic POST request to ElectionGuard service with retry logic and extensive logging
     */
    public String postRequest(String endpoint, Object requestBody) {
        long requestId = requestCounter.incrementAndGet();
        String threadName = Thread.currentThread().getName();
        long threadId = Thread.currentThread().threadId();
        Instant startTime = Instant.now();
        
        log.info("[REQ-{}][Thread-{}:{}] ===== STARTING POST REQUEST =====", requestId, threadName, threadId);
        log.info("[REQ-{}] Endpoint: {}", requestId, endpoint);
        log.info("[REQ-{}] Full URL: {}{}", requestId, baseUrl, endpoint);
        log.info("[REQ-{}] Request body class: {}", requestId, requestBody.getClass().getSimpleName());
        
        // Log connection pool stats BEFORE request
        logConnectionPoolStats(requestId, "BEFORE");

        try {
            log.info("[REQ-{}] Creating HTTP headers...", requestId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(requestBody, headers);
            log.info("[REQ-{}] HTTP entity created, sending request to microservice...", requestId);

            Instant requestSentTime = Instant.now();
            log.info("[REQ-{}] Calling restTemplate.postForEntity()...", requestId);
            
            ResponseEntity<String> response = restTemplate.postForEntity(
                baseUrl + endpoint,
                entity,
                String.class
            );
            
            Instant responseReceivedTime = Instant.now();
            long requestDuration = responseReceivedTime.toEpochMilli() - requestSentTime.toEpochMilli();
            long totalDuration = responseReceivedTime.toEpochMilli() - startTime.toEpochMilli();
            
            log.info("[REQ-{}] ===== RESPONSE RECEIVED =====", requestId);
            log.info("[REQ-{}] Status code: {}", requestId, response.getStatusCode());
            log.info("[REQ-{}] Request duration: {}ms", requestId, requestDuration);
            log.info("[REQ-{}] Total duration (including setup): {}ms", requestId, totalDuration);
            String responseBody = response.getBody();
            log.info("[REQ-{}] Response body length: {} chars", requestId, 
                responseBody != null ? responseBody.length() : 0);
            
            // Log connection pool stats AFTER response received
            logConnectionPoolStats(requestId, "AFTER");

            if (response.getStatusCode().is2xxSuccessful() && responseBody != null) {
                log.info("[REQ-{}] ✅ Successfully received valid response from {}", requestId, endpoint);
                log.info("[REQ-{}] ===== REQUEST COMPLETED SUCCESSFULLY =====", requestId);
                return responseBody;
            } else {
                log.error("[REQ-{}] ❌ Unexpected response for {}: {}", requestId, endpoint, response.getStatusCode());
                log.error("[REQ-{}] Response body: {}", requestId, response.getBody());
                throw new RuntimeException("Invalid response from ElectionGuard");
            }

        } catch (RestClientException e) {
            Instant errorTime = Instant.now();
            long errorDuration = errorTime.toEpochMilli() - startTime.toEpochMilli();
            
            log.error("[REQ-{}] ===== REQUEST FAILED =====", requestId);
            log.error("[REQ-{}] ❌ Failed to make POST request to {}", requestId, endpoint);
            log.error("[REQ-{}] Error type: {}", requestId, e.getClass().getName());
            log.error("[REQ-{}] Error message: {}", requestId, e.getMessage());
            log.error("[REQ-{}] Time elapsed before error: {}ms", requestId, errorDuration);
            log.error("[REQ-{}] Stack trace:", requestId, e);
            
            // Log connection pool stats on error
            logConnectionPoolStats(requestId, "ERROR");
            
            throw e;
        } finally {
            Instant endTime = Instant.now();
            long finalDuration = endTime.toEpochMilli() - startTime.toEpochMilli();
            log.info("[REQ-{}] ===== REQUEST LIFECYCLE ENDED (Total: {}ms) =====", requestId, finalDuration);
        }
    }

    /**
     * Generic GET request to ElectionGuard service with retry logic
     */
    public String getRequest(String endpoint) {
        log.info("Making GET request to ElectionGuard: {}", endpoint);

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                baseUrl + endpoint,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.info("Successfully received response from {}", endpoint);
                return response.getBody();
            } else {
                log.error("Unexpected response for {}: {}", endpoint, response.getStatusCode());
                throw new RuntimeException("Invalid response from ElectionGuard");
            }

        } catch (RestClientException e) {
            log.error("Failed to make GET request to {}: {}", endpoint, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Health check method
     */
    public boolean isHealthy() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                baseUrl + "/health",
                String.class
            );
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("ElectionGuard health check failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Get base URL for ElectionGuard service
     */
    public String getBaseUrl() {
        return baseUrl;
    }
    
    /**
     * Log connection pool statistics for debugging connection exhaustion issues
     */
    private void logConnectionPoolStats(long requestId, String phase) {
        try {
            HttpComponentsClientHttpRequestFactory factory = 
                (HttpComponentsClientHttpRequestFactory) restTemplate.getRequestFactory();
            
            // Use reflection to access the connection manager
            java.lang.reflect.Method method = factory.getHttpClient().getClass().getMethod("getConnectionManager");
            HttpClientConnectionManager connectionManager = (HttpClientConnectionManager) method.invoke(factory.getHttpClient());
            
            if (connectionManager instanceof PoolingHttpClientConnectionManager poolingManager) {
                
                int totalStats = poolingManager.getTotalStats().getAvailable() + 
                               poolingManager.getTotalStats().getLeased();
                int available = poolingManager.getTotalStats().getAvailable();
                int leased = poolingManager.getTotalStats().getLeased();
                int pending = poolingManager.getTotalStats().getPending();
                int max = poolingManager.getTotalStats().getMax();
                
                log.info("[REQ-{}][POOL-{}] Connection Pool Stats:", requestId, phase);
                log.info("[REQ-{}][POOL-{}]   Total Connections: {}", requestId, phase, totalStats);
                log.info("[REQ-{}][POOL-{}]   Available: {}", requestId, phase, available);
                log.info("[REQ-{}][POOL-{}]   Leased (In Use): {}", requestId, phase, leased);
                log.info("[REQ-{}][POOL-{}]   Pending: {}", requestId, phase, pending);
                log.info("[REQ-{}][POOL-{}]   Max: {}", requestId, phase, max);
                log.info("[REQ-{}][POOL-{}]   Usage: {}/{} ({}%)", requestId, phase, 
                    leased, max, (leased * 100) / max);
                
                if (leased >= max * 0.8) {
                    log.warn("[REQ-{}][POOL-{}] ⚠️ Connection pool usage HIGH (>80%)! Risk of exhaustion!", 
                        requestId, phase);
                }
                
                if (pending > 0) {
                    log.warn("[REQ-{}][POOL-{}] ⚠️ {} requests waiting for connections!", 
                        requestId, phase, pending);
                }
            }
        } catch (Exception e) {
            log.debug("[REQ-{}][POOL-{}] Could not retrieve connection pool stats: {}", 
                requestId, phase, e.getMessage());
        }
    }
}
