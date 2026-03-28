package com.amarvote.amarvote.dto;

public class UserSession {

    private String email;
    private String userType;
    private boolean canViewApiLogs;
    private boolean canManageAuthorizedUsers;

    public UserSession(String email) {
        this.email = email;
        this.userType = "user";
        this.canViewApiLogs = false;
        this.canManageAuthorizedUsers = false;
    }

    public UserSession(String email, String userType, boolean canViewApiLogs, boolean canManageAuthorizedUsers) {
        this.email = email;
        this.userType = userType;
        this.canViewApiLogs = canViewApiLogs;
        this.canManageAuthorizedUsers = canManageAuthorizedUsers;
    }

    public String getEmail() {
        return email;
    }

    public String getUserType() {
        return userType;
    }

    public boolean isCanViewApiLogs() {
        return canViewApiLogs;
    }

    public boolean isCanManageAuthorizedUsers() {
        return canManageAuthorizedUsers;
    }

}
