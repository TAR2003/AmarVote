package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionGuardTallyResponse {
    private Object ciphertext_tally; // Object - microservice returns dict
    private String status;
    private Object[] submitted_ballots;  // Object array - elements may be dicts
    private String message;
    private boolean success;
    
    // Keep the old field for backward compatibility
    private Object encrypted_tally;  // Object - microservice returns dict
    
    // Returns raw Object so callers can serialize to JSON string
    public Object getCiphertext_tally() {
        return ciphertext_tally != null ? ciphertext_tally : encrypted_tally;
    }
}
