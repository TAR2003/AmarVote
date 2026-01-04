package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OtpLoginResponseDto {
    private boolean success;
    private String message;
    private String token;
}
