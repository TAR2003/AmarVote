package com.amarvote.amarvote.dto;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class RegisterRequest {

    @NotBlank(message = "Username is required")
    private String userName;

    @Email(message = "Invalid email")
    @NotBlank(message = "Valid Email Address is required")
    private String email;

    //password must be at least 8 characters long and contain letters, numbers, and a special character
    @Pattern(regexp = "^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$%^&+=!]).{8,}$", message = "Password must be at least 8 characters long and contain letters, numbers, and a special character")
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

    // Setter methods for testing
    public void setUserName(String userName) {
        this.userName = userName;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }

    public void setNid(String nid) {
        this.nid = nid;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setProfilePic(String profilePic) {
        this.profilePic = profilePic;
    }

}
