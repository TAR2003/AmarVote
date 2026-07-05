package com.amarvote.amarvote.service;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class TurnstileService {

    private static final String VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    @Value("${turnstile.site-key:}")
    private String siteKey;

    @Value("${turnstile.secret:}")
    private String secret;

    @Value("${turnstile.enabled:true}")
    private boolean enabled;

    private final RestTemplate restTemplate;

    public boolean isEnabled() {
        return enabled
                && siteKey != null && !siteKey.isBlank()
                && secret != null && !secret.isBlank();
    }

    public String getSiteKey() {
        return isEnabled() ? siteKey : "";
    }

    public boolean verify(String token) {
        if (!isEnabled()) {
            return true;
        }
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("secret", secret);
            body.add("response", token);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(VERIFY_URL, body, Map.class);
            return response != null && Boolean.TRUE.equals(response.get("success"));
        } catch (Exception ex) {
            log.warn("Turnstile verification request failed: {}", ex.getMessage());
            return false;
        }
    }
}
