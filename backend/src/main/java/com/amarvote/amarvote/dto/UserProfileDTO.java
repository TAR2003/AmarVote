package com.amarvote.amarvote.dto;

/**
 * DTO for transferring user profile data to the frontend
 */
public class UserProfileDTO {
    private Integer userId;
    private String userEmail;
    private String userName;
    private String nid;
    private String profilePic;
    private boolean isVerified;
    // We don't include sensitive fields like passwordHash

    // Default constructor
    public UserProfileDTO() {
    }

    // Constructor with fields
    public UserProfileDTO(Integer userId, String userEmail, String userName, String nid, 
                        String profilePic, boolean isVerified) {
        this.userId = userId;
        this.userEmail = userEmail;
        this.userName = userName;
        this.nid = nid;
        this.profilePic = profilePic;
        this.isVerified = isVerified;
    }

    // Getters and setters
    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getNid() {
        return nid;
    }

    public void setNid(String nid) {
        this.nid = nid;
    }

    public String getProfilePic() {
        return profilePic;
    }

    public void setProfilePic(String profilePic) {
        this.profilePic = profilePic;
    }

    public boolean isVerified() {
        return isVerified;
    }

    public void setVerified(boolean verified) {
        isVerified = verified;
    }
}
