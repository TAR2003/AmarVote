package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MfaVerifyRequestDto {

    @NotBlank(message = "totpCode is required")
    @Pattern(regexp = "^[0-9]{6}$", message = "totpCode must be 6 digits")
    private String totpCode;
}
