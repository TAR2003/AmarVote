package com.amarvote.amarvote.dto;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class RegisterRequest {

    @NotBlank(message = "Username is required")
    private String userName;

    @Email(message = "Invalid email")
    @NotBlank(message = "Valid Email Address is required")
    private String email;

    @Size(min = 8, message = "Password must be at least 8 characters")
    @NotBlank(message = "Password is required")
    private String password;

    @NotBlank(message = "Confirm Password is required")
    private String confirmPassword;

    @NotBlank(message = "NID is required")
    private String nid;

    private OffsetDateTime createdAt;

    private String profilePic; // optional

    // Getters and Setters
    public String getUserName() {
        return userName;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public String getNid() {
        return nid;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public String getProfilePic() {
        return profilePic;
    }


}
