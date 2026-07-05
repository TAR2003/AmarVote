package com.amarvote.amarvote.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfigurationSource;

import com.amarvote.amarvote.filter.JWTFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_AUTH_PATHS = {
            "/api/auth/register",
            "/api/auth/register/send-email-code",
            "/api/auth/register/verify-email-code",
            "/api/auth/login",
            "/api/auth/mfa/confirm-setup",
            "/api/auth/mfa/verify",
            "/api/auth/session",
            "/api/auth/request-otp",
            "/api/auth/verify-otp",
            "/api/auth/logout",
            "/api/auth/password/send-email-code",
            "/api/auth/password/verify-email-code",
            "/api/auth/password/reset",
            "/api/password/forgot-password",
            "/api/password/create-password",
            "/api/verify/send-code",
            "/api/verify/verify-code",
            "/api/health",
            "/api/receipt/download"
    };

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private JWTFilter jwtFilter;

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    @Autowired
    private CookieCsrfTokenRepository cookieCsrfTokenRepository;

    @Value("${amarvote.chatbot.enabled:false}")
    private boolean chatbotEnabled;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(cookieCsrfTokenRepository)
                        .csrfTokenRequestHandler(csrfHandler)
                        .ignoringRequestMatchers(PUBLIC_AUTH_PATHS))
                .authorizeHttpRequests(authorize -> {
                    // SSE async dispatch re-enters the filter chain without SecurityContext — do not re-authorize
                    authorize.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll();
                    authorize.requestMatchers(PUBLIC_AUTH_PATHS).permitAll();
                    authorize.requestMatchers(
                            "/actuator/health", "/actuator/prometheus", "/actuator/metrics").permitAll();
                    if (chatbotEnabled) {
                        authorize.requestMatchers("/api/chatbot/**", "/api/test-deepseek").permitAll();
                    }
                    authorize.requestMatchers("/actuator/**").authenticated();
                    authorize.anyRequest().authenticated();
                })
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Authentication required\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Access denied\"}");
                        }))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(new BCryptPasswordEncoder(12));
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
