package com.amarvote.amarvote.filter;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
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

        String jwtToken = null;
        String userEmail = null;

        // First try to extract JWT from Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwtToken = authHeader.substring(7);
        }

        // If not found in header, try cookie
        if (jwtToken == null) {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("jwtToken".equals(cookie.getName())) {
                        jwtToken = cookie.getValue();
                        break;
                    }
                }
            }
        }

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
                    // parseSignedClaims (above) already verified the HMAC signature
                    if (jwtService.isTokenExpired(jwtToken)) {
                        logger.debug("Expired JWT for " + userEmail);
                    } else {
                        UserDetails userDetails = resolveUserDetails(userEmail);
                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);

                        request.setAttribute("jwtToken", jwtToken);
                        request.setAttribute("userEmail", userEmail);
                        authorizedUserService.markLastActive(userEmail);
                    }
                } catch (Exception e) {
                    logger.warn("JWT authentication failed for " + userEmail, e);
                }
            }
        }

        // Public routes do not require authentication (Bearer above is optional)
        if (isPublicRoute(requestPath)) {
            filterChain.doFilter(request, response);
            return;
        }

        filterChain.doFilter(request, response);
    }
    
    private boolean isPublicRoute(String requestPath) {
        String[] publicPaths = {
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
            "/api/test-deepseek",
            "/api/health",
            "/api/chatbot/"
        };

        for (String path : publicPaths) {
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
            return User.withUsername(userEmail)
                    .password("")
                    .authorities("ROLE_USER")
                    .accountExpired(false)
                    .accountLocked(false)
                    .credentialsExpired(false)
                    .disabled(false)
                    .build();
        }
    }
}
