package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Configuration
public class WebClientConfig {

    @Value("${webclient.buffer.size:10485760}") // Default 10MB
    private int bufferSize;

    @Value("${webclient.timeout.response:300000}") // Default 5 minutes
    private long responseTimeoutMs;

    @Bean
    public WebClient webClient() {
        // Increase buffer size to handle large responses
        ExchangeStrategies exchangeStrategies = ExchangeStrategies.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(bufferSize))
                .build();

        // Configure HttpClient with connection timeouts
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(java.time.Duration.ofMillis(responseTimeoutMs));

        return WebClient.builder()
                .baseUrl("http://electionguard:5000") // Your Python service URL
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(exchangeStrategies)
                .build();
    }
}