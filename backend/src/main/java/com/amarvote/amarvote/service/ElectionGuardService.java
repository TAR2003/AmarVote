package com.amarvote.amarvote.service;

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

@Service
public class ElectionGuardService {

    private static final Logger log = LoggerFactory.getLogger(ElectionGuardService.class);

    @Autowired
    @Qualifier("electionGuardRestTemplate")
    private RestTemplate restTemplate;

    @Value("${electionguard.base.url:http://electionguard:5000}")
    private String baseUrl;

    /**
     * Generic POST request to ElectionGuard service with retry logic
     */
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
            throw e;
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
}
