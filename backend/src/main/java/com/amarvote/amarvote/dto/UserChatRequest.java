package com.amarvote.amarvote.dto;

public class UserChatRequest {
    private String userMessage;
    
    public UserChatRequest() {}
    
    public UserChatRequest(String userMessage) {
        this.userMessage = userMessage;
    }

    // Getters and Setters
    public String getUserMessage() { return userMessage; }
    public void setUserMessage(String userMessage) { this.userMessage = userMessage; }
}
