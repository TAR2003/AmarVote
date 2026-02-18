package com.amarvote.amarvote.config;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.core5.util.Timeout;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

/**
 * WebClient and RestTemplate configuration for external APIs
 * - WebClient: For reactive/async APIs (DeepSeek, etc.)
 * - RestTemplate: For blocking APIs (RAG service, ElectionGuard)
 */
@Configuration
public class ExternalApiWebClientConfig {

    /**
     * RestTemplate bean for blocking HTTP calls (RAG service)
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .requestFactory(() -> {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(30000); // 30 seconds
                    factory.setReadTimeout(300000);   // 5 minutes for long operations
                    return factory;
                })
                .build();
    }

    /**
     * Separate RestTemplate bean for ElectionGuard service
     * Uses Apache HttpClient with connection pooling for better reliability
     * Optimized for sustained high-throughput processing (1000+ chunks)
     */
    @Bean("electionGuardRestTemplate")
    public RestTemplate electionGuardRestTemplate() {
        // Configure connection pool with aggressive idle connection eviction
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(100); // Increased for better concurrency
        connectionManager.setDefaultMaxPerRoute(50); // Increased per-route connections
        
        // Configure connection timeouts with aggressive validation
        ConnectionConfig connectionConfig = ConnectionConfig.custom()
                .setConnectTimeout(Timeout.ofSeconds(30))
                .setSocketTimeout(Timeout.ofMinutes(10)) // 10 minutes for crypto operations
                .setValidateAfterInactivity(Timeout.ofSeconds(5)) // Validate connections quickly
                .setTimeToLive(Timeout.ofMinutes(5)) // Force connection recycling
                .build();
        connectionManager.setDefaultConnectionConfig(connectionConfig);
        
        // Configure request timeouts
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofSeconds(30))
                .setResponseTimeout(Timeout.ofMinutes(10))
                .build();
        
        // Create HttpClient with aggressive idle connection eviction and connection reuse
        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(requestConfig)
                .evictIdleConnections(Timeout.ofSeconds(30)) // Aggressively evict idle connections
                .evictExpiredConnections() // Automatically evict expired connections
                .setConnectionReuseStrategy((request, response, context) -> true) // Force connection reuse
                .build();
        
        // Create request factory with HttpClient
        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(httpClient);
        requestFactory.setBufferRequestBody(false); // Stream requests to reduce memory
        
        return new RestTemplate(requestFactory);
    }

    @Bean
    public WebClient webClient() {
        // Configure connection provider
        ConnectionProvider connectionProvider = ConnectionProvider.builder("external-api")
                .maxConnections(50)
                .maxIdleTime(Duration.ofSeconds(120))
                .maxLifeTime(Duration.ofSeconds(300))
                .pendingAcquireTimeout(Duration.ofSeconds(60))
                .evictInBackground(Duration.ofSeconds(120))
                .build();

        // Increase buffer size for large responses
        ExchangeStrategies exchangeStrategies = ExchangeStrategies.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10485760)) // 10MB
                .build();

        // Configure HttpClient with timeouts
        HttpClient httpClient = HttpClient.create(connectionProvider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000) // 30 seconds
                .responseTimeout(Duration.ofSeconds(300)) // 5 minutes for long operations
                .doOnConnected(conn -> 
                    conn.addHandlerLast(new ReadTimeoutHandler(300, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(300, TimeUnit.SECONDS))
                )
                .keepAlive(true);

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(exchangeStrategies)
                .build();
    }
}
