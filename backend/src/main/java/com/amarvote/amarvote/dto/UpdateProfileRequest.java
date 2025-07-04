package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for updating user profile data from the frontend
 */
public class UpdateProfileRequest {
    @NotBlank(message = "User name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String userName;
    
    private String profilePic;
    
    @Pattern(regexp = "^[0-9]{10,17}$", message = "NID must be a numeric value between 10-17 digits")
    private String nid;

    // Default constructor
    public UpdateProfileRequest() {
    }

    // Constructor with fields
    public UpdateProfileRequest(String userName, String profilePic, String nid) {
        this.userName = userName;
        this.profilePic = profilePic;
        this.nid = nid;
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

    public String getNid() {
        return nid;
    }

    public void setNid(String nid) {
        this.nid = nid;
    }
}
