package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetWithTokenRequestDto {

    private String resetPasswordToken;

    @NotBlank(message = "New password is required")
    @Size(min = 12, message = "New password must be at least 12 characters")
    @Pattern(
            regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
            message = "Password must include upper, lower, digit, and special character")
    private String newPassword;
}
