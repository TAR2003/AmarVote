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
    private String ciphertext_tally; // ✅ JSON string - NOT raw JSON object
    private String status;
    private String[] submitted_ballots;  // ✅ JSON strings in array
    private String message;
    private boolean success;
    
    // Keep the old field for backward compatibility
    private String encrypted_tally;  // ✅ JSON string - NOT raw JSON object
    
    // ✅ Fixed: Return ciphertext_tally directly as string
    public String getCiphertext_tally() {
        return ciphertext_tally != null ? ciphertext_tally : encrypted_tally;
    }
}
