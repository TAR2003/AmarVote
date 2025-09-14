package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO for updating user profile data from the frontend
 */
public class UpdateProfileRequest {
    @NotBlank(message = "User name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String userName;
    
    private String profilePic;

    // Default constructor
    public UpdateProfileRequest() {
    }

    // Constructor with fields
    public UpdateProfileRequest(String userName, String profilePic) {
        this.userName = userName;
        this.profilePic = profilePic;
    }

    // Getters and setters
    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getProfilePic() {
        return profilePic;
    }

    public void setProfilePic(String profilePic) {
        this.profilePic = profilePic;
    }
}
