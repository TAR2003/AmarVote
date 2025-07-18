package com.amarvote.amarvote.dto;

public class RAGRequest {
    private String query;
    private Integer maxLength;
    private Integer k;
    private String documentType;

    public RAGRequest() {}
    
    public RAGRequest(String query) {
        this.query = query;
    }
    
    public RAGRequest(String query, Integer maxLength, Integer k) {
        this.query = query;
        this.maxLength = maxLength;
        this.k = k;
    }
    
    public RAGRequest(String query, Integer maxLength, Integer k, String documentType) {
        this.query = query;
        this.maxLength = maxLength;
        this.k = k;
        this.documentType = documentType;
    }

    // Getters and Setters
    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }

    public Integer getMaxLength() { return maxLength; }
    public void setMaxLength(Integer maxLength) { this.maxLength = maxLength; }

    public Integer getK() { return k; }
    public void setK(Integer k) { this.k = k; }
    
    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }
}
