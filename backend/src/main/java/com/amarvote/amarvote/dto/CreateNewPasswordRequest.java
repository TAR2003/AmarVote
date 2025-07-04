package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class CreateNewPasswordRequest {

    @NotBlank(message = "Reset token is required")
    private String resetToken;
    
    @Pattern(regexp = "^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$%^&+=!]).{8,}$", message = "Password must be at least 8 characters long and contain letters, numbers, and a special character")
    @NotBlank(message = "New password is required")
    private String newPassword;

    public CreateNewPasswordRequest(String resetToken, String newPassword) {
        this.resetToken = resetToken;
        this.newPassword = newPassword;
    }

    public String getResetToken() {
        return resetToken;
    }

    public String getNewPassword() {
        return newPassword;
    }

}
