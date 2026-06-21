package com.amarvote.amarvote.filter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.service.ApiLogService;
import com.amarvote.amarvote.service.JWTService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Records metadata-only access logs (method, path, status, IP, user email, timing).
 * Does not persist JWTs, request bodies, or response bodies.
 */
@Component
@Order(1)
public class ApiLoggingFilter extends OncePerRequestFilter {

    private static final Pattern PROGRESS_STREAM = Pattern.compile("^/api/elections/\\d+/progress/stream$");

    @Autowired
    private ApiLogService apiLogService;

    @Autowired
    private JWTService jwtService;

    @Value("${amarvote.api-logging.enabled:true}")
    private boolean loggingEnabled;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!loggingEnabled) {
            return true;
        }

        String path = request.getRequestURI();
        if (path == null) {
            return false;
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        if (path.startsWith("/actuator") || "/api/health".equals(path)) {
            return true;
        }

        return PROGRESS_STREAM.matcher(path).matches();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        long startTime = System.currentTimeMillis();

        ApiLog apiLog = new ApiLog();
        apiLog.setRequestMethod(request.getMethod());
        apiLog.setRequestPath(request.getRequestURI());
        apiLog.setRequestIp(getClientIp(request));
        apiLog.setUserAgent(truncate(request.getHeader("User-Agent"), 500));
        apiLog.setRequestTime(LocalDateTime.now());

        String email = extractEmailFromRequest(request);
        if (email != null) {
            apiLog.setExtractedEmail(email);
        }

        try {
            filterChain.doFilter(request, response);
            apiLog.setResponseStatus(response.getStatus());
        } catch (Exception e) {
            apiLog.setErrorMessage(truncate(e.getMessage(), 500));
            apiLog.setResponseStatus(response.getStatus() > 0 ? response.getStatus() : 500);
            throw e;
        } finally {
            apiLog.setResponseTime(System.currentTimeMillis() - startTime);
            try {
                apiLogService.saveLog(apiLog);
            } catch (Exception e) {
                System.err.println("Failed to save API log: " + e.getMessage());
            }
        }
    }

    private String extractEmailFromRequest(HttpServletRequest request) {
        String jwtToken = extractJwtToken(request);
        if (jwtToken == null) {
            return null;
        }
        try {
            return jwtService.extractUserEmailFromToken(jwtToken);
        } catch (Exception ignored) {
            return null;
        }
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

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    private static String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
