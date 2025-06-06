package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class ChangePasswordRequest {

    @Email(message = "Please provide a valid email address")
    @NotBlank(message = "Email must not be blank")
    private String email;
    
    @NotBlank(message = "Old password must not be blank")
    private String oldPassword;

    @Pattern(regexp = "^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$%^&+=!]).{8,}$", message = "Password must be at least 8 characters long and contain letters, numbers, and a special character")
    @NotBlank(message = "New password is required")
    private String newPassword;

    public ChangePasswordRequest(String email, String oldPassword, String newPassword) {
        this.email = email;
        this.oldPassword = oldPassword;
        this.newPassword = newPassword;
    }

    public String getEmail() {
        return email;
    }

    public String getOldPassword() {
        return oldPassword;
    }

    public String getNewPassword() {
        return newPassword;
    }
}
