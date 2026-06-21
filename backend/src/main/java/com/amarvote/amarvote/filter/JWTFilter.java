package com.amarvote.amarvote.filter;

import java.io.IOException;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.amarvote.amarvote.service.AuthorizedUserService;
import com.amarvote.amarvote.service.JWTService;
import com.amarvote.amarvote.service.MyUserDetailsService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JWTFilter extends OncePerRequestFilter {

    private static final String[] PUBLIC_PATHS = {
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
            "/api/health"
    };

    @Autowired
    private JWTService jwtService;

    @Autowired
    private MyUserDetailsService userDetailsService;

    @Autowired
    private AuthorizedUserService authorizedUserService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        String jwtToken = extractJwtToken(request);
        String userEmail = null;

        if (jwtToken != null) {
            try {
                userEmail = jwtService.extractUserEmailFromToken(jwtToken);
                if (userEmail != null) {
                    userEmail = userEmail.trim().toLowerCase();
                }
            } catch (Exception e) {
                logger.warn("Failed to extract user from JWT", e);
            }

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    if (jwtService.isTokenExpired(jwtToken)) {
                        logger.debug("Expired JWT for " + userEmail);
                    } else {
                        Optional<String> denialReason = authorizedUserService.getApiAccessDenialReason(userEmail);
                        if (denialReason.isPresent()) {
                            sendForbidden(response, denialReason.get());
                            return;
                        }
                        UserDetails userDetails = resolveUserDetails(userEmail);
                        if (userDetails == null) {
                            logger.debug("JWT valid but user no longer exists: " + userEmail);
                        } else {
                            authorizedUserService.markLastActive(userEmail);
                            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                            SecurityContextHolder.getContext().setAuthentication(authToken);
                            request.setAttribute("jwtToken", jwtToken);
                            request.setAttribute("userEmail", userEmail);
                        }
                    }
                } catch (Exception e) {
                    logger.warn("JWT authentication failed for " + userEmail, e);
                }
            }
        }

        if (isPublicRoute(requestPath)) {
            filterChain.doFilter(request, response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String extractJwtToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwtToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private void sendForbidden(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message.replace("\"", "\\\"") + "\"}");
    }

    private boolean isPublicRoute(String requestPath) {
        for (String path : PUBLIC_PATHS) {
            if (requestPath.startsWith(path)) {
                return true;
            }
        }
        return false;
    }

    private UserDetails resolveUserDetails(String userEmail) {
        try {
            return userDetailsService.loadUserByUsername(userEmail);
        } catch (UsernameNotFoundException ex) {
            return null;
        }
    }
}
