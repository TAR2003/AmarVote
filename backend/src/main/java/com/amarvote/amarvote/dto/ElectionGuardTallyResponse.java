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
    private Object ciphertext_tally; // Changed to Object to handle JSON
    private String status;
    private String[] submitted_ballots;
    private String message;
    private boolean success;
    
    // Keep the old field for backward compatibility
    private String encrypted_tally;
    
    // Convenience method to get ciphertext_tally as Object for JSON storage
    public Object getEncrypted_tally() {
        return ciphertext_tally != null ? ciphertext_tally : encrypted_tally;
    }
}
