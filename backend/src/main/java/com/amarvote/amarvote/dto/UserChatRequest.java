package com.amarvote.amarvote.dto;

public class UserChatRequest {
    private String userMessage;
    private String sessionId; // Optional: to maintain conversation context with DeepSeek
    
    public UserChatRequest() {}
    
    public UserChatRequest(String userMessage) {
        this.userMessage = userMessage;
    }
    
    public UserChatRequest(String userMessage, String sessionId) {
        this.userMessage = userMessage;
        this.sessionId = sessionId;
    }

    // Getters and Setters
    public String getUserMessage() { return userMessage; }
    public void setUserMessage(String userMessage) { this.userMessage = userMessage; }
    
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
}
