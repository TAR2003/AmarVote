package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
public class CorsConfig {

    @Value("${amarvote.cors.allowed-origins:https://amarvote2026.me,http://localhost:5173,http://localhost:3000}")
    private String allowedOrigins;

    @Value("${amarvote.public.base-url:}")
    private String publicBaseUrl;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        Set<String> origins = new LinkedHashSet<>(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList()));

        String base = publicBaseUrl == null ? null : publicBaseUrl.trim().replaceAll("/+$", "");
        if (base != null && !base.isEmpty()) {
            origins.add(base);
        }

        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.copyOf(origins));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization", "Content-Type", "X-Requested-With", "X-XSRF-TOKEN",
                "ngrok-skip-browser-warning"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
