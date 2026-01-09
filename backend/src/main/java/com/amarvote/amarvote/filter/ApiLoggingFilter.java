package com.amarvote.amarvote.filter;

import java.io.IOException;
import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.service.ApiLogService;
import com.amarvote.amarvote.service.JWTService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(1) // Execute before JWTFilter
public class ApiLoggingFilter extends OncePerRequestFilter {

    @Autowired
    private ApiLogService apiLogService;
    
    @Autowired
    private JWTService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        long startTime = System.currentTimeMillis();
        
        // Wrap request and response to capture content
        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        
        // Create log entry
        ApiLog apiLog = new ApiLog();
        apiLog.setRequestMethod(request.getMethod());
        apiLog.setRequestPath(request.getRequestURI());
        apiLog.setRequestIp(getClientIp(request));
        apiLog.setUserAgent(request.getHeader("User-Agent"));
        apiLog.setRequestTime(LocalDateTime.now());
        
        // Extract JWT token
        String jwtToken = extractJwtToken(request);
        if (jwtToken != null) {
            apiLog.setBearerToken(jwtToken);
            
            // Try to extract email from token
            try {
                String email = jwtService.extractUserEmailFromToken(jwtToken);
                apiLog.setExtractedEmail(email);
            } catch (Exception e) {
                // Token might be invalid, but we still log it
            }
        }
        
        try {
            // Continue the filter chain
            filterChain.doFilter(wrappedRequest, wrappedResponse);
            
            // After request processing
            long endTime = System.currentTimeMillis();
            apiLog.setResponseTime(endTime - startTime);
            apiLog.setResponseStatus(wrappedResponse.getStatus());
            
            // Get request body (for POST/PUT/PATCH)
            if ("POST".equalsIgnoreCase(request.getMethod()) || 
                "PUT".equalsIgnoreCase(request.getMethod()) || 
                "PATCH".equalsIgnoreCase(request.getMethod())) {
                
                byte[] content = wrappedRequest.getContentAsByteArray();
                if (content.length > 0) {
                    String requestBody = new String(content, wrappedRequest.getCharacterEncoding());
                    // Truncate if too long
                    if (requestBody.length() > 5000) {
                        requestBody = requestBody.substring(0, 5000) + "... [truncated]";
                    }
                    // Don't log sensitive data like passwords
                    if (!requestBody.contains("password") && !requestBody.contains("otp_code")) {
                        apiLog.setRequestBody(requestBody);
                    }
                }
            }
            
        } catch (Exception e) {
            apiLog.setErrorMessage(e.getMessage());
            apiLog.setResponseStatus(500);
            throw e;
        } finally {
            // Save log asynchronously
            try {
                apiLogService.saveLog(apiLog);
            } catch (Exception e) {
                // Don't fail the request if logging fails
                System.err.println("Failed to save API log: " + e.getMessage());
            }
            
            // Copy response back to original response
            wrappedResponse.copyBodyToResponse();
        }
    }
    
    private String extractJwtToken(HttpServletRequest request) {
        // First try Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        
        // Then try cookie
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
        // If multiple IPs, take the first one
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
