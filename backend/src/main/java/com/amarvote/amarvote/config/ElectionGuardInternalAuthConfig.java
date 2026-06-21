package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.util.Collections;

@Configuration
public class ElectionGuardInternalAuthConfig {

    @Bean(name = "electionGuardInternalAuthInterceptor")
    public ClientHttpRequestInterceptor electionGuardInternalAuthInterceptor(
            @Value("${electionguard.internal.api-key:}") String apiKey) {
        return new ClientHttpRequestInterceptor() {
            @Override
            public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
                    throws IOException {
                if (StringUtils.hasText(apiKey)) {
                    request.getHeaders().put("X-ElectionGuard-Internal-Key", Collections.singletonList(apiKey));
                }
                return execution.execute(request, body);
            }
        };
    }
}
