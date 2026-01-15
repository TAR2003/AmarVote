package com.amarvote.amarvote.config;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

/**
 * WebClient configuration for external APIs (DeepSeek, RAG, etc.)
 * Note: ElectionGuard service uses RestTemplate (see RestTemplateConfig)
 */
@Configuration
public class ExternalApiWebClientConfig {

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
