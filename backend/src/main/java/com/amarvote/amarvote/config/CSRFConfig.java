package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

@Configuration
public class CSRFConfig {

    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @Bean
    public CookieCsrfTokenRepository cookieCsrfTokenRepository() {
        CookieCsrfTokenRepository tokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        tokenRepository.setCookieName("XSRF-TOKEN");
        tokenRepository.setHeaderName("X-XSRF-TOKEN");
        // Keep Secure aligned with auth cookies (required behind ngrok HTTPS)
        tokenRepository.setSecure(cookieSecure);
        tokenRepository.setCookieCustomizer(cookie -> cookie.sameSite("Strict"));
        return tokenRepository;
    }

    @Bean
    public CsrfTokenRequestAttributeHandler csrfTokenRequestHandler() {
        return new CsrfTokenRequestAttributeHandler();
    }
}
