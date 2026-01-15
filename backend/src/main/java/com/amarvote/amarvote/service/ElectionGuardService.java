package com.amarvote.amarvote.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class ElectionGuardService {

    private static final Logger log = LoggerFactory.getLogger(ElectionGuardService.class);

    @Autowired
    @Qualifier("electionGuardRestTemplate")
    private RestTemplate restTemplate;

    @Value("${electionguard.base.url:http://electionguard:5000}")
    private String baseUrl;

    /**
     * Generic POST request to ElectionGuard service with circuit breaker and retry
     */
    @CircuitBreaker(name = "electionguard", fallbackMethod = "postRequestFallback")
    @Retry(name = "electionguard")
    public String postRequest(String endpoint, Object requestBody) {
        log.info("Making POST request to ElectionGuard: {}", endpoint);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                baseUrl + endpoint,
                entity,
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
            log.error("Failed to make POST request to {}: {}", endpoint, e.getMessage(), e);
            throw e; // Let retry/circuit breaker handle it
        }
    }

    /**
     * Generic GET request to ElectionGuard service with circuit breaker and retry
     */
    @CircuitBreaker(name = "electionguard", fallbackMethod = "getRequestFallback")
    @Retry(name = "electionguard")
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
            throw e; // Let retry/circuit breaker handle it
        }
    }

    // Fallback method for POST requests when circuit breaker opens
    private String postRequestFallback(String endpoint, Object requestBody, Exception e) {
        log.error("Circuit breaker activated for POST {}: {}", endpoint, e.getMessage());
        throw new RuntimeException("ElectionGuard service is currently unavailable: " + e.getMessage(), e);
    }

    // Fallback method for GET requests when circuit breaker opens
    private String getRequestFallback(String endpoint, Exception e) {
        log.error("Circuit breaker activated for GET {}: {}", endpoint, e.getMessage());
        throw new RuntimeException("ElectionGuard service is currently unavailable: " + e.getMessage(), e);
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
}
