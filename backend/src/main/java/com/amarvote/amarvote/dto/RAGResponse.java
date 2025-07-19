package com.amarvote.amarvote.dto;

public class RAGResponse {
    private String query;
    private String context;
    private Integer maxLength;
    private boolean success;
    private String error;

    public RAGResponse() {}
    
    public RAGResponse(String query, String context) {
        this.query = query;
        this.context = context;
        this.success = true;
    }
    
    public RAGResponse(String query, String error, boolean success) {
        this.query = query;
        this.error = error;
        this.success = success;
    }

    // Getters and Setters
    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }

    public String getContext() { return context; }
    public void setContext(String context) { this.context = context; }

    public Integer getMaxLength() { return maxLength; }
    public void setMaxLength(Integer maxLength) { this.maxLength = maxLength; }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
