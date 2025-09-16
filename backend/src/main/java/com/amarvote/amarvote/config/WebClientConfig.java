package com.amarvote.amarvote.config;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
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

@Configuration
public class WebClientConfig {

    @Value("${webclient.buffer.size:10485760}") // Default 10MB
    private int bufferSize;

    @Value("${webclient.timeout.response:300000}") // Default 5 minutes
    private long responseTimeoutMs;

    @Bean
    public WebClient webClient() {
        // Configure connection provider with longer timeouts
        ConnectionProvider connectionProvider = ConnectionProvider.builder("custom")
                .maxConnections(100)
                .maxIdleTime(Duration.ofSeconds(300))
                .maxLifeTime(Duration.ofSeconds(300))
                .pendingAcquireTimeout(Duration.ofSeconds(60))
                .evictInBackground(Duration.ofSeconds(120))
                .build();

        // Increase buffer size to handle large responses
        ExchangeStrategies exchangeStrategies = ExchangeStrategies.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(bufferSize))
                .build();

        // Configure HttpClient with comprehensive timeout settings
        HttpClient httpClient = HttpClient.create(connectionProvider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 300000) // 5 minutes connection timeout
                .responseTimeout(Duration.ofMillis(responseTimeoutMs)) // 5 minutes response timeout
                .doOnConnected(conn -> 
                    conn.addHandlerLast(new ReadTimeoutHandler(300, TimeUnit.SECONDS))  // 5 minutes read timeout
                        .addHandlerLast(new WriteTimeoutHandler(300, TimeUnit.SECONDS)) // 5 minutes write timeout
                )
                .keepAlive(true);

        return WebClient.builder()
                .baseUrl("http://electionguard:5000") // Your Python service URL
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(exchangeStrategies)
                .build();
    }
}