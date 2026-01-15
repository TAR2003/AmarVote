package com.amarvote.amarvote.config;

import java.util.concurrent.TimeUnit;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.core5.util.TimeValue;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

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
        // Configure connection settings
        ConnectionConfig connectionConfig = ConnectionConfig.custom()
            .setConnectTimeout(connectionTimeout, TimeUnit.MILLISECONDS)
            .setSocketTimeout(socketTimeout, TimeUnit.MILLISECONDS)
            .build();

        // Configure connection pool
        PoolingHttpClientConnectionManager connectionManager = 
            new PoolingHttpClientConnectionManager();
        
        // Set total max connections across all routes
        connectionManager.setMaxTotal(maxConnections);
        
        // Set max connections per route (per host)
        connectionManager.setDefaultMaxPerRoute(maxPerRoute);
        
        // Set default connection config
        connectionManager.setDefaultConnectionConfig(connectionConfig);

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
            .evictIdleConnections(TimeValue.ofMinutes(5)) // Cleanup idle connections
            .evictExpiredConnections() // Cleanup expired connections
            .build();

        // Create request factory
        HttpComponentsClientHttpRequestFactory factory = 
            new HttpComponentsClientHttpRequestFactory(httpClient);

        return new RestTemplate(factory);
    }
}