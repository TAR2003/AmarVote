package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OtpResponseDto {
    private boolean success;
    private String message;
    private String status;
    private boolean alreadySent;

    public OtpResponseDto(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
}
