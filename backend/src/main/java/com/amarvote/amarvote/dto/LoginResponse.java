package com.amarvote.amarvote.dto;


public class LoginResponse {

    private String token;
    private boolean success;
    private String message; 
    private String email;//testing purpose will delete it later

    public LoginResponse(String token, String email, boolean success, String message) {
        this.token = token;
        this.email = email; // testing purpose
        this.success = success;
        this.message = message;
    }

    public String getToken() {
        return token;
    }
    
    public boolean isSuccess(){
        return success;
    }

    public String getMessage() {
        return message;
    }

    public String getEmail() {
        return email; // testing purpose
    }

}

