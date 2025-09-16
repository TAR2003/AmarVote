package com.amarvote.amarvote.config;

// RestTemplateConfig.java
import java.time.Duration;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {
    
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(300)); // 5 minutes
        factory.setReadTimeout(Duration.ofSeconds(300));    // 5 minutes
        
        return builder
                .requestFactory(() -> factory)
                .build();
    }
}