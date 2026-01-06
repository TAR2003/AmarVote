package com.amarvote.amarvote.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.amarvote.amarvote.service.JWTService;

/**
 * Utility class for JWT token operations
 * Wraps JWTService for convenience
 */
@Component
public class JwtUtil {
    
    @Autowired
    private JWTService jwtService;
    
    /**
     * Generate JWT token for user email
     */
    public String generateToken(String userEmail) {
        return jwtService.generateJWTToken(userEmail);
    }
    
    /**
     * Extract user email from JWT token
     */
    public String extractUserEmail(String token) {
        return jwtService.extractUserEmailFromToken(token);
    }
}
