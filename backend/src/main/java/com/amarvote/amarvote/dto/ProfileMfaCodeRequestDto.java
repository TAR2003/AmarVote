package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProfileMfaCodeRequestDto {

    @NotBlank(message = "totpCode is required")
    private String totpCode;
}
