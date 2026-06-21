package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.io.HttpClientConnectionManager;
import org.msgpack.jackson.dataformat.MessagePackFactory;
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

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.amarvote.amarvote.exception.ElectionGuardCapacityException;

@Service
public class ElectionGuardService {

    private static final Logger log = LoggerFactory.getLogger(ElectionGuardService.class);
    private static final AtomicLong requestCounter = new AtomicLong(0);

    /**
     * Dedicated ObjectMapper that speaks MessagePack (binary).
     * Used to serialize Java request objects -> msgpack bytes, and to
     * deserialize msgpack response bytes -> generic Java object tree.
     */
    private static final ObjectMapper MSGPACK_MAPPER;

    /**
     * Standard JSON ObjectMapper used only to re-encode the deserialized
     * msgpack response tree back to a JSON string so that all callers that
     * rely on {@code objectMapper.readValue(response, SomeDto.class)} keep
     * working without any modification.
     */
    private static final ObjectMapper JSON_MAPPER;

    static {
        MSGPACK_MAPPER = new ObjectMapper(new MessagePackFactory());
        MSGPACK_MAPPER.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        JSON_MAPPER = new ObjectMapper();
        JSON_MAPPER.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    private static final MediaType MSGPACK_MEDIA_TYPE = MediaType.valueOf("application/msgpack");

    @Autowired
    @Qualifier("electionGuardApiRestTemplate")
    private RestTemplate apiRestTemplate;

    @Autowired
    @Qualifier("electionGuardWorkerRestTemplate")
    private RestTemplate workerRestTemplate;

    @Autowired
    private ElectionGuardConcurrencyGate concurrencyGate;

    @Value("${electionguard.api.url:http://electionguard-api:5000}")
    private String apiUrl;

    @Value("${electionguard.worker.url:http://electionguard-worker:5001}")
    private String workerUrl;

    @Value("${electionguard.base.url:http://electionguard-api:5000}")
    private String baseUrl;

    /**
     * Determine if an endpoint should use the worker service (heavy operations).
     * Worker endpoints: create_encrypted_tally, create_partial_decryption,
     *                   create_compensated_decryption, combine_decryption_shares
     * API endpoints: All others (setup_guardians, create_encrypted_ballot, benaloh_challenge, etc.)
     */
    private boolean isWorkerEndpoint(String endpoint) {
        return endpoint.contains("/create_encrypted_tally") ||
               endpoint.contains("/create_partial_decryption") ||
               endpoint.contains("/create_compensated_decryption") ||
               endpoint.contains("/combine_decryption_shares");
    }

    private RestTemplate restTemplateFor(String endpoint) {
        return isWorkerEndpoint(endpoint) ? workerRestTemplate : apiRestTemplate;
    }

    /**
     * Generic POST request to ElectionGuard service using MessagePack transport.
     *
     * <p>Transport protocol (matches the Python single_election.py client):
     * <ul>
     *   <li>Request body: msgpack-serialized Java object (Content-Type: application/msgpack)</li>
     *   <li>Response body: msgpack-encoded map from the Flask service (Accept: application/msgpack)</li>
     * </ul>
     *
     * <p>Return value: A JSON string re-encoded from the deserialized msgpack map.
     * All callers remain unchanged -- they still do {@code objectMapper.readValue(response, Dto.class)}.
     */
    public String postRequest(String endpoint, Object requestBody) {
        long requestId = requestCounter.incrementAndGet();
        String threadName = Thread.currentThread().getName();
        long threadId = Thread.currentThread().threadId();
        Instant startTime = Instant.now();
        String serviceUrl = isWorkerEndpoint(endpoint) ? workerUrl : apiUrl;
        String serviceType = isWorkerEndpoint(endpoint) ? "WORKER" : "API";

        log.debug("[REQ-{}][Thread-{}:{}] POST {} ({})", requestId, threadName, threadId, endpoint, serviceType);
        log.debug("[REQ-{}] URL: {}{}", requestId, serviceUrl, endpoint);

        RestTemplate client = restTemplateFor(endpoint);
        logConnectionPoolStats(requestId, "BEFORE", client);

        Supplier<String> sendRequest = () -> sendPostRequest(requestId, client, serviceUrl, endpoint, requestBody, startTime);

        try {
            if (isWorkerEndpoint(endpoint)) {
                return concurrencyGate.executeWorker(sendRequest);
            }
            return concurrencyGate.executeApi(sendRequest);
        } catch (ElectionGuardCapacityException e) {
            log.warn("[REQ-{}] Capacity limit reached for {}: {}", requestId, endpoint, e.getMessage());
            throw e;
        }
    }

    private String sendPostRequest(long requestId, RestTemplate client, String serviceUrl, String endpoint, Object requestBody, Instant startTime) {
        try {
            // -- Serialize request -> msgpack bytes -----------------------------
            byte[] requestBytes = MSGPACK_MAPPER.writeValueAsBytes(requestBody);
            log.debug("[REQ-{}] Serialized request: {} bytes", requestId, requestBytes.length);

            // -- Build HTTP entity with msgpack content-type -------------------
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MSGPACK_MEDIA_TYPE);
            headers.setAccept(Collections.singletonList(MSGPACK_MEDIA_TYPE));
            HttpEntity<byte[]> entity = new HttpEntity<>(requestBytes, headers);

            // -- Send request, expecting raw bytes back ------------------------
            Instant requestSentTime = Instant.now();
            log.debug("[REQ-{}] Sending msgpack request...", requestId);

            ResponseEntity<byte[]> response = client.postForEntity(
                    serviceUrl + endpoint,
                    entity,
                    byte[].class
            );

            Instant responseReceivedTime = Instant.now();
            long requestDuration = responseReceivedTime.toEpochMilli() - requestSentTime.toEpochMilli();
            long totalDuration = responseReceivedTime.toEpochMilli() - startTime.toEpochMilli();

            log.debug("[REQ-{}] {} {}ms (total {}ms)", requestId, response.getStatusCode(), requestDuration, totalDuration);

            logConnectionPoolStats(requestId, "AFTER", client);

            byte[] responseBytes = response.getBody();
            if (response.getStatusCode().is2xxSuccessful() && responseBytes != null) {
                log.debug("[REQ-{}] Response {} bytes", requestId, responseBytes.length);
                Object responseObj = MSGPACK_MAPPER.readValue(responseBytes, Object.class);
                String jsonString = JSON_MAPPER.writeValueAsString(responseObj);
                log.debug("[REQ-{}] OK {} ({}ms)", requestId, endpoint, totalDuration);
                return jsonString;
            } else {
                log.error("[REQ-{}] [ERROR] Unexpected response for {}: {}", requestId, endpoint, response.getStatusCode());
                throw new RuntimeException("Invalid response from ElectionGuard (status: " + response.getStatusCode() + ")");
            }

        } catch (RestClientException e) {
            Instant errorTime = Instant.now();
            long errorDuration = errorTime.toEpochMilli() - startTime.toEpochMilli();

            log.error("[REQ-{}] ===== REQUEST FAILED =====", requestId);
            log.error("[REQ-{}] [FAILED] Failed to make POST request to {}", requestId, endpoint);
            log.error("[REQ-{}] Error type: {}", requestId, e.getClass().getName());
            log.error("[REQ-{}] Error message: {}", requestId, e.getMessage());
            log.error("[REQ-{}] Time elapsed before error: {}ms", requestId, errorDuration);
            log.error("[REQ-{}] Stack trace:", requestId, e);

            logConnectionPoolStats(requestId, "ERROR", client);
            throw e;
        } catch (Exception e) {
            Instant errorTime = Instant.now();
            long errorDuration = errorTime.toEpochMilli() - startTime.toEpochMilli();

            log.error("[REQ-{}] ===== MSGPACK SERIALIZATION/DESERIALIZATION FAILED =====", requestId);
            log.error("[REQ-{}] Error type: {}", requestId, e.getClass().getName());
            log.error("[REQ-{}] Error message: {}", requestId, e.getMessage());
            log.error("[REQ-{}] Time elapsed before error: {}ms", requestId, errorDuration);

            logConnectionPoolStats(requestId, "ERROR", client);
            throw new RuntimeException("msgpack transport error for " + endpoint + ": " + e.getMessage(), e);
        }
    }

    /**
     * Generic GET request to ElectionGuard service.
     * GET responses (health checks, status queries) remain plain JSON.
     */
    public String getRequest(String endpoint) {
        boolean worker = isWorkerEndpoint(endpoint);
        String serviceUrl = worker ? workerUrl : apiUrl;
        RestTemplate client = worker ? workerRestTemplate : apiRestTemplate;
        log.debug("GET {} ({})", endpoint, worker ? "WORKER" : "API");

        try {
            ResponseEntity<String> response = client.getForEntity(
                    serviceUrl + endpoint,
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
     * Health check -- checks both API and Worker services via their JSON /health endpoints.
     */
    public boolean isHealthy() {
        try {
            ResponseEntity<String> apiResponse = apiRestTemplate.getForEntity(
                    apiUrl + "/health", String.class);

            ResponseEntity<String> workerResponse = workerRestTemplate.getForEntity(
                    workerUrl + "/health", String.class);

            boolean apiHealthy = apiResponse.getStatusCode().is2xxSuccessful();
            boolean workerHealthy = workerResponse.getStatusCode().is2xxSuccessful();

            if (!apiHealthy)    log.warn("ElectionGuard API service health check failed");
            if (!workerHealthy) log.warn("ElectionGuard Worker service health check failed");

            return apiHealthy && workerHealthy;
        } catch (Exception e) {
            log.warn("ElectionGuard health check failed: {}", e.getMessage());
            return false;
        }
    }

    /** Return the configured base URL. */
    public String getBaseUrl() {
        return baseUrl;
    }

    // --------------------------------------------------------------------------
    // Internal helpers
    // --------------------------------------------------------------------------

    private void logConnectionPoolStats(long requestId, String phase, RestTemplate client) {
        try {
            HttpComponentsClientHttpRequestFactory factory =
                    (HttpComponentsClientHttpRequestFactory) client.getRequestFactory();

            java.lang.reflect.Method method = factory.getHttpClient().getClass().getMethod("getConnectionManager");
            HttpClientConnectionManager connectionManager =
                    (HttpClientConnectionManager) method.invoke(factory.getHttpClient());

            if (connectionManager instanceof PoolingHttpClientConnectionManager poolingManager) {
                int available = poolingManager.getTotalStats().getAvailable();
                int leased    = poolingManager.getTotalStats().getLeased();
                int pending   = poolingManager.getTotalStats().getPending();
                int max       = poolingManager.getTotalStats().getMax();

                log.debug("[REQ-{}][POOL-{}] available={} leased={} pending={} max={}",
                        requestId, phase, available, leased, pending, max);

                if (leased >= max * 0.8) {
                    log.warn("[REQ-{}][POOL-{}] [WARN] Connection pool usage HIGH (>80%)! Risk of exhaustion!",
                            requestId, phase);
                }
                if (pending > 0) {
                    log.warn("[REQ-{}][POOL-{}] [WARN] {} requests waiting for connections!",
                            requestId, phase, pending);
                }
            }
        } catch (Exception e) {
            log.debug("[REQ-{}][POOL-{}] Could not retrieve connection pool stats: {}",
                    requestId, phase, e.getMessage());
        }
    }
}
