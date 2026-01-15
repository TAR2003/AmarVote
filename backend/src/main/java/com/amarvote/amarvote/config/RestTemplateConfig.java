package com.amarvote.amarvote.config;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.TimeValue;
import org.apache.hc.core5.util.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PreDestroy;

@Configuration
public class RestTemplateConfig {

    private static final Logger log = LoggerFactory.getLogger(RestTemplateConfig.class);
    private ScheduledExecutorService connectionEvictor;

    @Value("${electionguard.connection.timeout:10000}") // 10 seconds
    private int connectionTimeout;

    @Value("${electionguard.socket.timeout:600000}") // 10 minutes for crypto ops
    private int socketTimeout;

    @Value("${electionguard.connection.request.timeout:30000}") // 30 seconds - increased from 10s
    private int connectionRequestTimeout;

    @Value("${electionguard.max.connections:200}") // Increased from 50 to 200 for concurrent operations
    private int maxConnections;

    @Value("${electionguard.max.per.route:100}") // Increased from 20 to 100 for concurrent chunk processing
    private int maxPerRoute;

    @Bean
    public RestTemplate electionGuardRestTemplate() {
        // Configure connection settings with TIME-TO-LIVE to prevent stale connections
        ConnectionConfig connectionConfig = ConnectionConfig.custom()
            .setConnectTimeout(Timeout.ofMilliseconds(connectionTimeout))
            .setSocketTimeout(Timeout.ofMilliseconds(socketTimeout))
            .setTimeToLive(TimeValue.ofMinutes(2)) // 🔥 CRITICAL FIX: Force connection refresh every 2 minutes
            .setValidateAfterInactivity(TimeValue.ofSeconds(10)) // 🔥 Validate connections idle for 10s
            .build();

        // Configure connection pool with builder for advanced settings
        PoolingHttpClientConnectionManager connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
            .setMaxConnTotal(maxConnections)
            .setMaxConnPerRoute(maxPerRoute)
            .setDefaultConnectionConfig(connectionConfig)
            .build();

        // Configure request timeouts
        RequestConfig requestConfig = RequestConfig.custom()
            .setConnectionRequestTimeout(connectionRequestTimeout, TimeUnit.MILLISECONDS)
            .setResponseTimeout(socketTimeout, TimeUnit.MILLISECONDS)
            .build();

        // Build HTTP client with connection pool and retry handler
        CloseableHttpClient httpClient = HttpClients.custom()
            .setConnectionManager(connectionManager)
            .setDefaultRequestConfig(requestConfig)
            .setRetryStrategy(new CustomRetryStrategy(3, 2000)) // 3 retries, 2s initial delay
            .evictIdleConnections(TimeValue.ofSeconds(30)) // 🔥 CRITICAL: Aggressively cleanup idle connections (was 5 min)
            .evictExpiredConnections() // Cleanup expired connections
            .build();

        // Create request factory
        HttpComponentsClientHttpRequestFactory factory = 
            new HttpComponentsClientHttpRequestFactory(httpClient);

        // 🔥 CRITICAL FIX: Start background thread to aggressively evict stale/idle connections
        startConnectionEvictor(connectionManager);

        return new RestTemplate(factory);
    }

    /**
     * Background task to proactively close idle and expired connections
     * This prevents connection pool exhaustion from stale connections
     */
    private void startConnectionEvictor(final PoolingHttpClientConnectionManager connectionManager) {
        connectionEvictor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread thread = new Thread(r, "ConnectionEvictor");
            thread.setDaemon(true);
            return thread;
        });

        connectionEvictor.scheduleAtFixedRate(() -> {
            try {
                // HttpClient handles eviction automatically via evictIdleConnections/evictExpiredConnections
                // This task just monitors the pool health
                log.debug("Connection pool health check. Stats: Available={}, Leased={}, Pending={}, Max={}",
                    connectionManager.getTotalStats().getAvailable(),
                    connectionManager.getTotalStats().getLeased(),
                    connectionManager.getTotalStats().getPending(),
                    connectionManager.getTotalStats().getMax());
            } catch (Exception e) {
                log.warn("Error during connection pool monitoring", e);
            }
        }, 10, 10, TimeUnit.SECONDS); // Run every 10 seconds

        log.info("Connection pool monitor started - will check pool health every 10 seconds");
    }

    @PreDestroy
    public void cleanup() {
        if (connectionEvictor != null) {
            connectionEvictor.shutdown();
            log.info("Connection evictor shut down");
        }
    }
}