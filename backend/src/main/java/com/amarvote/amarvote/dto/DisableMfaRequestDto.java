package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DisableMfaRequestDto {

    @NotBlank(message = "Current password is required")
    private String currentPassword;

    @NotBlank(message = "2FA code is required")
    private String totpCode;
}
