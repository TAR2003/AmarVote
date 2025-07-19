package com.amarvote.amarvote.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import com.amarvote.amarvote.dto.RAGRequest;
import com.amarvote.amarvote.dto.RAGResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class RAGService {
    
    private static final Logger logger = LoggerFactory.getLogger(RAGService.class);
    
    @Value("${rag.service.url:http://localhost:5001}")
    private String ragServiceUrl;
    
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    @Autowired
    public RAGService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
    }
    
    /**
     * Get relevant context from the RAG service for a given query
     */
    public RAGResponse getRelevantContext(String query) {
        return getRelevantContext(query, 2000, null);
    }
    
    /**
     * Get relevant context from the RAG service for a given query with custom max length
     */
    public RAGResponse getRelevantContext(String query, Integer maxLength) {
        return getRelevantContext(query, maxLength, null);
    }
    
    /**
     * Get relevant context from the RAG service for a given query with custom max length and document type
     */
    public RAGResponse getRelevantContext(String query, Integer maxLength, String documentType) {
        try {
            // Create request body with document type filter
            RAGRequest ragRequest = new RAGRequest(query, maxLength, 3, documentType);
            
            // Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            // Create HTTP entity
            HttpEntity<RAGRequest> entity = new HttpEntity<>(ragRequest, headers);
            
            // Make request to RAG service
            String url = ragServiceUrl + "/context";
            String response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class).getBody();
            
            // Parse response
            JsonNode responseNode = objectMapper.readTree(response);
            String context = responseNode.get("context").asText();
            
            logger.info("Successfully retrieved context from RAG service for query: {} (type: {})", query, documentType);
            return new RAGResponse(query, context);
            
        } catch (ResourceAccessException e) {
            logger.error("RAG service is not available: {}", e.getMessage());
            return new RAGResponse(query, "RAG service is currently unavailable", false);
        } catch (Exception e) {
            logger.error("Error getting context from RAG service: {}", e.getMessage());
            return new RAGResponse(query, "Error retrieving information from documentation", false);
        }
    }
    
    /**
     * Check if the query is related to ElectionGuard
     */
    public boolean isElectionGuardRelated(String query) {
        String lowerQuery = query.toLowerCase();
        
        // Primary ElectionGuard-specific keywords
        String[] primaryKeywords = {
            "electionguard", "election guard", "electionguard technology",
            "cryptographic voting", "homomorphic encryption", "end-to-end verifiability",
            "zero knowledge proof", "chaum pedersen", "elgamal encryption",
            "schnorr proof", "ballot encryption", "cryptographic proof",
            "guardian key", "trustee key", "decryption share"
        };
        
        // Secondary keywords that need context
        String[] secondaryKeywords = {
            "encryption", "decrypt", "guardian", "trustee", "proof", "verification",
            "manifest", "cryptographic", "homomorphic", "verifiable"
        };
        
        // Check for primary keywords first (these are definitely ElectionGuard)
        for (String keyword : primaryKeywords) {
            if (lowerQuery.contains(keyword)) {
                return true;
            }
        }
        
        // For secondary keywords, require additional context to avoid false positives
        for (String keyword : secondaryKeywords) {
            if (lowerQuery.contains(keyword)) {
                // Check if it's in ElectionGuard context
                if (lowerQuery.contains("electionguard") || 
                    lowerQuery.contains("cryptographic voting") ||
                    lowerQuery.contains("ballot encryption") ||
                    lowerQuery.contains("end-to-end") ||
                    lowerQuery.contains("homomorphic")) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if the query is related to AmarVote platform usage
     */
    public boolean isAmarVotePlatformRelated(String query) {
        String lowerQuery = query.toLowerCase();
        
        // Platform-specific keywords
        String[] platformKeywords = {
            "amarvote", "create election", "how to vote", "voting process", 
            "election setup", "account", "login", "register", "signup",
            "dashboard", "profile", "verification", "vote verification",
            "ballot tracking", "election results", "voter registration",
            "how to create", "how to vote", "how to verify", "how to see results",
            "platform", "website", "interface", "user guide", "tutorial",
            "step by step", "instructions", "help", "support"
        };
        
        // Check for platform-related keywords
        for (String keyword : platformKeywords) {
            if (lowerQuery.contains(keyword)) {
                return true;
            }
        }
        
        // Check for question patterns about platform usage
        String[] usagePatterns = {
            "how.*create.*election",
            "how.*vote.*election", 
            "how.*verify.*vote",
            "how.*see.*result",
            "how.*check.*result",
            "how.*register.*vote",
            "how.*use.*platform",
            "how.*login",
            "how.*signup",
            "what.*steps.*vote",
            "what.*steps.*create",
            "where.*find.*election",
            "where.*see.*result"
        };
        
        for (String pattern : usagePatterns) {
            if (lowerQuery.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get AmarVote platform context for user guidance queries
     */
    public RAGResponse getAmarVotePlatformContext(String query) {
        return getRelevantContext(query, 2000, "AmarVote_User_Guide");
    }
    
    /**
     * Health check for RAG service
     */
    public boolean isRAGServiceHealthy() {
        try {
            String url = ragServiceUrl + "/health";
            String response = restTemplate.getForObject(url, String.class);
            JsonNode responseNode = objectMapper.readTree(response);
            return "healthy".equals(responseNode.get("status").asText());
        } catch (Exception e) {
            logger.warn("RAG service health check failed: {}", e.getMessage());
            return false;
        }
    }
}