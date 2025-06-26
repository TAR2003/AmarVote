package com.amarvote.amarvote.dto;

import com.amarvote.amarvote.model.PasswordResetToken;

public class TokenValidationResult {
    private boolean valid;
    private String reason; // e.g., "used", "expired", "not_found"
    private PasswordResetToken token;

    public TokenValidationResult(boolean valid, String reason, PasswordResetToken token) {
        this.valid = valid;
        this.reason = reason;
        this.token = token;
    }

    public boolean isValid() {
        return valid;
    }

    public String getReason() {
        return reason;
    }

    public PasswordResetToken getToken() {
        return token;
    }

    
}

