package com.amarvote.amarvote.controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.ChatMessage;
import com.amarvote.amarvote.dto.ChatRequest;
import com.amarvote.amarvote.dto.RAGResponse;
import com.amarvote.amarvote.dto.UserChatRequest;
import com.amarvote.amarvote.service.ElectionService;
import com.amarvote.amarvote.service.RAGService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.netty.channel.ChannelOption;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

@RestController
@RequestMapping("/api")
public class ChatController {

    @Value("${deepseek.api.key}")
    private String apiKey;

    @Value("${deepseek.api.url}")
    private String apiUrl;

    @Autowired
    private RAGService ragService;

    @Autowired
    private ElectionService electionService;

    private final WebClient webClient;

    public ChatController() {
        // Configure HttpClient with timeouts
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000) // 30 seconds connect timeout
                .responseTimeout(java.time.Duration.ofSeconds(120)); // 120 seconds response timeout

        this.webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    @GetMapping("/test-deepseek")
    public Mono<String> testDeepSeek() {
        ChatMessage userMessage = new ChatMessage("user", "Hello, who are you?");
        ChatRequest chatRequest = new ChatRequest("deepseek/deepseek-chat-v3-0324:free", Collections.singletonList(userMessage));

        return webClient.post()
                .uri(apiUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .header("HTTP-Referer", "https://amarvote2025.me") // required by OpenRouter
                .header("X-Title", "AmarVote-Test") // optional, but helpful
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(chatRequest)
                .retrieve()
                .bodyToMono(String.class) // returns raw JSON from DeepSeek
                .map(json -> {
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    JsonNode root = mapper.readTree(json);
                    return root.get("choices").get(0).get("message").get("content").asText();
                } catch (Exception e) {
                    return "Failed to parse response: " + e.getMessage();
                }
            });
    }

    @PostMapping("/chat")
    public Mono<String> chat(@RequestBody UserChatRequest request) {
        String userMessage = request.getUserMessage();
        String sessionId = request.getSessionId();
        
        // First, check if the query is related to voting/elections at all
        if (!isVotingOrElectionRelated(userMessage)) {
            return Mono.just("I'm AmarVote's AI Assistant, specialized in helping with voting and election-related topics. " +
                    "I can help you with:\n\n" +
                    "• How to create and manage elections\n" +
                    "• Understanding voting systems and processes\n" +
                    "• ElectionGuard cryptographic security\n" +
                    "• Election results and verification\n" +
                    "• Voting platform features and usage\n\n" +
                    "Please ask me something related to voting, elections, or the AmarVote platform!");
        }
        
        // Smart routing using intent classification
        ChatIntent intent = classifyIntent(userMessage);
        
        switch (intent) {
            case ELECTION_RESULTS:
                return handleElectionResultChat(userMessage, sessionId);
            case ELECTIONGUARD_TECHNICAL:
                return handleElectionGuardChat(userMessage, sessionId);
            case AMARVOTE_PLATFORM_USAGE:
                return handleAmarVotePlatformChat(userMessage, sessionId);
            case GENERAL_ELECTORAL:
            default:
                return handleGeneralChat(userMessage, sessionId);
        }
    }
    
    // Intent classification enum
    private enum ChatIntent {
        ELECTION_RESULTS,
        ELECTIONGUARD_TECHNICAL,
        AMARVOTE_PLATFORM_USAGE,
        GENERAL_ELECTORAL
    }
    
    /**
     * Intelligent intent classification using multiple signals
     */
    private ChatIntent classifyIntent(String userMessage) {
        String lowerMessage = userMessage.toLowerCase().trim();
        
        // Check for follow-up phrases that should use the previous context
        // These should be handled by GENERAL_ELECTORAL to maintain session context
        String[] followUpPhrases = {
            "yes.*want.*more", "yes.*want.*deeper", "yes.*want.*dive", "yes.*tell.*more",
            "want.*dive.*deeper", "want.*more.*detail", "want.*know.*more",
            "tell.*more.*about", "explain.*more.*about", "more.*about.*that",
            "dive.*deeper.*into", "go.*deeper.*into", "elaborate.*on.*that",
            "yes", "yeah", "yep", "sure", "ok", "okay", "continue", "tell me more", 
            "more", "go on", "please", "tell me", "explain", "details", "more details",
            "more info", "more information", "elaborate", "expand", "deeper", "dive deeper"
        };
        
        // Check for follow-up patterns first - route to GENERAL_ELECTORAL for session context
        for (String phrase : followUpPhrases) {
            if (lowerMessage.equals(phrase) || lowerMessage.equals(phrase + ".") || 
                lowerMessage.equals(phrase + "!") || lowerMessage.equals(phrase + "?") ||
                lowerMessage.matches(".*" + phrase + ".*")) {
                return ChatIntent.GENERAL_ELECTORAL; // Use general handler to maintain session context
            }
        }
        
        // 1. Check for election results intent first (most specific)
        if (isElectionResultQuery(lowerMessage)) {
            return ChatIntent.ELECTION_RESULTS;
        }
        
        // 2. Check for AmarVote platform usage intent
        if (isAmarVotePlatformQuery(lowerMessage)) {
            return ChatIntent.AMARVOTE_PLATFORM_USAGE;
        }
        
        // 3. Check for ElectionGuard technical intent using semantic patterns
        if (isElectionGuardTechnicalQuery(lowerMessage)) {
            return ChatIntent.ELECTIONGUARD_TECHNICAL;
        }
        
        // 4. Default to general electoral discussion
        return ChatIntent.GENERAL_ELECTORAL;
    }
    
    /**
     * Improved ElectionGuard detection using semantic patterns
     */
    private boolean isElectionGuardTechnicalQuery(String lowerMessage) {
        // High-confidence ElectionGuard indicators
        String[] highConfidencePatterns = {
            "electionguard",
            "election guard",
            "cryptographic voting",
            "homomorphic encryption",
            "end-to-end verifiability",
            "zero knowledge proof",
            "chaum pedersen",
            "elgamal encryption",
            "schnorr proof",
            "ballot encryption",
            "guardian key",
            "trustee key",
            "decryption share"
        };
        
        // Check for high-confidence patterns
        for (String pattern : highConfidencePatterns) {
            if (lowerMessage.contains(pattern)) {
                return true;
            }
        }
        
        // Medium-confidence patterns that need context
        String[] mediumConfidenceTerms = {
            "cryptographic", "encryption", "decrypt", "proof", "verification", 
            "guardian", "trustee", "homomorphic"
        };
        
        // Count how many technical terms appear
        int technicalTermCount = 0;
        for (String term : mediumConfidenceTerms) {
            if (lowerMessage.contains(term)) {
                technicalTermCount++;
            }
        }
        
        // If multiple technical terms + voting context, likely ElectionGuard
        if (technicalTermCount >= 2 && (lowerMessage.contains("voting") || lowerMessage.contains("ballot") || lowerMessage.contains("election"))) {
            return true;
        }
        
        // Check for specific ElectionGuard question patterns
        String[] electionGuardQuestionPatterns = {
            "how does.*encrypt.*work",
            "what is.*homomorphic",
            "how.*verification.*work",
            "what.*zero knowledge",
            "how.*guardian.*work",
            "what.*elgamal",
            "how.*ballot.*encrypt",
            "what.*cryptographic.*proof"
        };
        
        for (String pattern : electionGuardQuestionPatterns) {
            if (lowerMessage.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        
        return false;
    }

    @PostMapping("/chat/electionguard")
    public Mono<String> chatWithElectionGuardContext(@RequestBody UserChatRequest request) {
        return handleElectionGuardChat(request.getUserMessage(), request.getSessionId());
    }

    private Mono<String> handleElectionGuardChat(String userMessage, String sessionId) {
        // Check if the query is related to ElectionGuard
        if (!ragService.isElectionGuardRelated(userMessage)) {
            return Mono.just("I'm specialized in answering questions about ElectionGuard. " +
                    "Please ask me about ElectionGuard's cryptographic voting system, " +
                    "ballot encryption, verification, or related topics.");
        }

        // Get relevant context from RAG service asynchronously
        return Mono.fromCallable(() -> ragService.getRelevantContext(userMessage))
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .flatMap(ragResponse -> {
                    if (!ragResponse.isSuccess()) {
                        return Mono.just("I'm sorry, I'm having trouble accessing the ElectionGuard documentation right now. " +
                                "Please try again later.");
                    }

                    // Try multiple search strategies for better context
                    String enhancedContext = getEnhancedContext(userMessage, ragResponse.getContext());
                    
                    // Create enhanced prompt with context
                    String enhancedPrompt = createEnhancedPrompt(userMessage, enhancedContext);
                    
                    // Create chat messages with session awareness
                    List<ChatMessage> messages = new ArrayList<>();
                    
                    // Add system message with session-aware instructions
                    String systemMessage = "You are an ElectionGuard expert. Answer questions naturally and directly. " +
                            "Use any provided technical information, and supplement with your knowledge when needed. " +
                            "Don't mention sources or documentation - just explain the concepts clearly.";
                    
                    // If we have a sessionId, add session context to system message
                    if (sessionId != null && !sessionId.isEmpty()) {
                        systemMessage += " This is part of an ongoing conversation (Session: " + sessionId + "). " +
                                "Remember the context from previous questions in this session and provide detailed follow-up responses.";
                    }
                    
                    messages.add(new ChatMessage("system", systemMessage));
                    messages.add(new ChatMessage("user", enhancedPrompt));

                    ChatRequest chatRequest = new ChatRequest("deepseek/deepseek-chat-v3-0324:free", messages);

                    return webClient.post()
                            .uri(apiUrl)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                            .header("HTTP-Referer", "https://amarvote2025.me")
                            .header("X-Title", "AmarVote-ElectionGuard-Chat-" + (sessionId != null ? sessionId : "default"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(chatRequest)
                            .retrieve()
                            .bodyToMono(String.class)
                            .map(json -> {
                                try {
                                    ObjectMapper mapper = new ObjectMapper();
                                    JsonNode root = mapper.readTree(json);
                                    String response = root.get("choices").get(0).get("message").get("content").asText();
                                    
                                    // Post-process to remove meta-commentary
                                    return cleanResponse(response);
                                } catch (Exception e) {
                                    return "Failed to parse response: " + e.getMessage();
                                }
                            });
                });
    }

    @PostMapping("/chat/general")
    public Mono<String> generalChat(@RequestBody UserChatRequest request) {
        String userMessage = request.getUserMessage();
        
        ChatMessage systemMessage = new ChatMessage("system", 
                "You are a helpful assistant for AmarVote, a secure voting platform. " +
                "Provide helpful and accurate information about voting, elections, and related topics.");
        ChatMessage userMsg = new ChatMessage("user", userMessage);
        
        List<ChatMessage> messages = new ArrayList<>();
        messages.add(systemMessage);
        messages.add(userMsg);

        ChatRequest chatRequest = new ChatRequest("deepseek/deepseek-chat-v3-0324:free", messages);

        return webClient.post()
                .uri(apiUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .header("HTTP-Referer", "https://amarvote2025.me")
                .header("X-Title", "AmarVote-General-Chat")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(chatRequest)
                .retrieve()
                .bodyToMono(String.class)
                .map(json -> {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        JsonNode root = mapper.readTree(json);
                        return root.get("choices").get(0).get("message").get("content").asText();
                    } catch (Exception e) {
                        return "Failed to parse response: " + e.getMessage();
                    }
                });
    }

    @GetMapping("/rag/health")
    public String checkRAGHealth() {
        boolean isHealthy = ragService.isRAGServiceHealthy();
        return isHealthy ? "RAG service is healthy" : "RAG service is not available";
    }

    private String createEnhancedPrompt(String userMessage, String context) {
        return String.format(
                "Here's information about ElectionGuard:\n%s\n\n" +
                "Question: %s",
                context, userMessage
        );
    }

    private String getEnhancedContext(String userMessage, String originalContext) {
        // Try to get additional context with related search terms for common topics
        String additionalContext = "";
        
        String lowerMessage = userMessage.toLowerCase();
        
        // For encryption-related queries, try multiple search strategies
        if (lowerMessage.contains("encrypt") || lowerMessage.contains("cipher") || lowerMessage.contains("algorithm")) {
            // Try to get context about ElGamal encryption specifically
            RAGResponse elgamalResponse = ragService.getRelevantContext("ElGamal encryption algorithm cryptographic", 1000);
            if (elgamalResponse.isSuccess() && !elgamalResponse.getContext().equals(originalContext)) {
                additionalContext += "\n\nAdditional context about encryption:\n" + elgamalResponse.getContext();
            }
            
            // Try to get context about ballot encryption process
            RAGResponse processResponse = ragService.getRelevantContext("ballot encryption process steps", 1000);
            if (processResponse.isSuccess() && !processResponse.getContext().equals(originalContext)) {
                additionalContext += "\n\nAdditional context about process:\n" + processResponse.getContext();
            }
        }
        
        // For verification-related queries
        if (lowerMessage.contains("verify") || lowerMessage.contains("proof") || lowerMessage.contains("validate")) {
            RAGResponse verifyResponse = ragService.getRelevantContext("verification proof validation", 1000);
            if (verifyResponse.isSuccess() && !verifyResponse.getContext().equals(originalContext)) {
                additionalContext += "\n\nAdditional context about verification:\n" + verifyResponse.getContext();
            }
        }
        
        // For decryption-related queries
        if (lowerMessage.contains("decrypt") || lowerMessage.contains("tally") || lowerMessage.contains("result")) {
            RAGResponse decryptResponse = ragService.getRelevantContext("decryption tally guardian shares", 1000);
            if (decryptResponse.isSuccess() && !decryptResponse.getContext().equals(originalContext)) {
                additionalContext += "\n\nAdditional context about decryption:\n" + decryptResponse.getContext();
            }
        }
        
        return originalContext + additionalContext;
    }

    private String cleanResponse(String response) {
        // Remove meta-commentary about sources and documentation
        String cleaned = response
            // Remove opening phrases about context/documentation
            .replaceAll("(?i)^[^.]*(?:provided context|specification|documentation)[^.]*does not[^.]*\\.", "ElectionGuard")
            .replaceAll("(?i)^[^.]*(?:context|specification)[^.]*(?:mentions|shows|describes)[^.]*:", "")
            .replaceAll("(?i)based on[^,]*(?:context|specification|documentation)[^,.]*[,.]\\s*", "")
            .replaceAll("(?i)according to[^,]*(?:context|specification)[^,.]*[,.]\\s*", "")
            .replaceAll("(?i)the (?:provided )?context[^,.]*[,.]\\s*", "")
            .replaceAll("(?i)from the (?:provided )?context[^,.]*[,.]\\s*", "")
            
            // Remove sentences about missing information
            .replaceAll("(?i)[^.]*(?:context|specification) does not (?:contain|provide|include)[^.]*\\.", "")
            .replaceAll("(?i)[^.]*would need additional[^.]*\\.", "")
            .replaceAll("(?i)[^.]*for a complete answer[^.]*\\.", "")
            .replaceAll("(?i)for (?:those )?specifics[^.]*\\.", "")
            .replaceAll("(?i)if you need[^.]*please[^.]*\\.", "")
            
            // Clean up transitions and however statements
            .replaceAll("(?i)however, it does (?:mention|describe|provide)", "")
            .replaceAll("(?i)the (?:given|provided) (?:context|excerpt)[^.]*\\.", "")
            
            .trim();
            
        // Clean up formatting issues
        cleaned = cleaned
            .replaceAll("\\s+", " ")
            .replaceAll("^[,:\\s]+", "")
            .replaceAll("\\s*\\.\\s*\\.", ".")
            .replaceAll("\\s*,\\s*,", ",")
            .trim();
            
        return cleaned;
    }

    /**
     * Improved election results detection using context and intent
     */
    private boolean isElectionResultQuery(String lowerMessage) {
        // Direct result queries
        String[] directResultPatterns = {
            "results? of.*election",
            "winner of.*election", 
            "who won.*election",
            "outcome of.*election",
            "final result.*election",
            "election.*results?",
            "show.*results?",
            "list.*elections?",
            "recent.*elections?",
            "latest.*elections?",
            "completed.*elections?",
            "result.*of.*last.*election",
            "result.*of.*the.*last.*election",
            "last.*election.*result",
            "most recent.*election",
            "newest.*election",
            "previous.*election"
        };
        
        for (String pattern : directResultPatterns) {
            if (lowerMessage.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        
        // Specific result-seeking phrases
        String[] resultSeekingPhrases = {
            "vote count", "total votes", "how many votes", 
            "voting results", "election outcome", "who is winning",
            "current results", "preliminary results",
            "result of the last", "result of last", "last election"
        };
        
        for (String phrase : resultSeekingPhrases) {
            if (lowerMessage.contains(phrase)) {
                return true;
            }
        }
        
        // Exclude if it's clearly about electoral systems/processes rather than results
        String[] processTerms = {
            "how does.*work", "what is.*system", "explain.*process",
            "types of.*voting", "electoral.*process", "voting.*method",
            "how to.*vote", "voting.*procedure"
        };
        
        for (String term : processTerms) {
            if (lowerMessage.matches(".*" + term + ".*")) {
                return false; // This is about process, not results
            }
        }
        
        return false;
    }

    /**
     * Check if a query is related to AmarVote platform usage
     */
    private boolean isAmarVotePlatformQuery(String lowerMessage) {
        // Platform usage patterns
        String[] platformPatterns = {
            "how.*create.*election",
            "how.*vote.*election", 
            "how.*verify.*vote",
            "how.*see.*result",
            "how.*check.*result",
            "how to vote",
            "how to create",
            "how to verify",
            "steps.*vote",
            "steps.*create",
            "steps.*creating.*election",
            "steps.*of.*creating",
            "process.*creating.*election",
            "create.*election.*process",
            "voting process",
            "election setup",
            "election creation",
            "account.*create",
            "sign up",
            "register.*account",
            "login.*account",
            "dashboard",
            "profile",
            "tutorial",
            "guide",
            "instructions",
            "help.*platform",
            "use.*amarvote",
            "amarvote.*work"
        };
        
        for (String pattern : platformPatterns) {
            if (lowerMessage.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        
        // Direct platform keywords
        String[] platformKeywords = {
            "amarvote platform", "platform features", "user guide", 
            "voting interface", "election dashboard", "ballot tracking",
            "vote verification", "account management", "voter registration",
            "create election", "creating election", "election creation",
            "steps to create", "how to create election"
        };
        
        for (String keyword : platformKeywords) {
            if (lowerMessage.contains(keyword)) {
                return true;
            }
        }
        
        return false;
    }

    private Mono<String> handleAmarVotePlatformChat(String userMessage, String sessionId) {
        // Get relevant context from AmarVote user guide asynchronously
        return Mono.fromCallable(() -> ragService.getAmarVotePlatformContext(userMessage))
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .flatMap(ragResponse -> {
                    if (!ragResponse.isSuccess()) {
                        return Mono.just("I'm sorry, I'm having trouble accessing the AmarVote user guide right now. " +
                                "Please try again later or contact support for assistance.");
                    }

                    // Create enhanced prompt with platform context
                    String enhancedPrompt = String.format(
                            "Here's information from the AmarVote User Guide:\n%s\n\n" +
                            "Question: %s",
                            ragResponse.getContext(), userMessage
                    );
                    
                    // Create chat messages with session awareness
                    List<ChatMessage> messages = new ArrayList<>();
                    
                    // Add system message with session-aware instructions
                    String systemMessage = "You are AmarVote's helpful platform assistant. Answer questions about using the AmarVote platform " +
                            "based on the provided user guide information. Be specific, step-by-step, and user-friendly. " +
                            "Focus on practical instructions for creating elections, voting, verification, and platform features.";
                    
                    // If we have a sessionId, add session context to system message
                    if (sessionId != null && !sessionId.isEmpty()) {
                        systemMessage += " This is part of an ongoing conversation (Session: " + sessionId + "). " +
                                "Remember the context from previous questions in this session and provide detailed follow-up responses.";
                    }
                    
                    messages.add(new ChatMessage("system", systemMessage));
                    messages.add(new ChatMessage("user", enhancedPrompt));

                    ChatRequest chatRequest = new ChatRequest("deepseek/deepseek-chat-v3-0324:free", messages);

                    return webClient.post()
                            .uri(apiUrl)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                            .header("HTTP-Referer", "https://amarvote2025.me")
                            .header("X-Title", "AmarVote-Platform-Chat-" + (sessionId != null ? sessionId : "default"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .bodyValue(chatRequest)
                            .retrieve()
                            .bodyToMono(String.class)
                            .map(json -> {
                                try {
                                    ObjectMapper mapper = new ObjectMapper();
                                    JsonNode root = mapper.readTree(json);
                                    return root.get("choices").get(0).get("message").get("content").asText();
                                } catch (Exception e) {
                                    return "Failed to parse response: " + e.getMessage();
                                }
                            });
                });
    }

    private Mono<String> handleElectionResultChat(String userMessage, String sessionId) {
        // Extract election information and provide results directly
        return getElectionInfo(userMessage)
            .map(electionInfo -> {
                if (electionInfo.isEmpty()) {
                    return "No election information found. Please try asking about a specific election or check if there are any public completed elections available.";
                }
                
                // Return the formatted election information directly without sending to AI
                return electionInfo;
            });
    }

    /**
     * Check if a query is related to voting, elections, or the platform
     */
    private boolean isVotingOrElectionRelated(String userMessage) {
        String lowerMessage = userMessage.toLowerCase().trim();
        
        // Handle common follow-up responses that indicate user wants to continue the conversation
        String[] followUpResponses = {
            "yes", "yeah", "yep", "sure", "ok", "okay", "continue", "tell me more", 
            "more", "go on", "please", "tell me", "explain", "details", "more details",
            "more info", "more information", "elaborate", "expand", "deeper", "dive deeper"
        };
        
        // Check for exact matches first
        for (String response : followUpResponses) {
            if (lowerMessage.equals(response) || lowerMessage.equals(response + ".") || 
                lowerMessage.equals(response + "!") || lowerMessage.equals(response + "?")) {
                return true; // Treat follow-up responses as voting-related to continue conversation
            }
        }
        
        // Check for follow-up phrases that contain these terms
        String[] followUpPhrases = {
            "yes.*want.*more", "yes.*want.*deeper", "yes.*want.*dive", "yes.*tell.*more",
            "want.*dive.*deeper", "want.*more.*detail", "want.*know.*more",
            "tell.*more.*about", "explain.*more.*about", "more.*about.*that",
            "dive.*deeper.*into", "go.*deeper.*into", "elaborate.*on.*that"
        };
        
        for (String phrase : followUpPhrases) {
            if (lowerMessage.matches(".*" + phrase + ".*")) {
                return true;
            }
        }
        
        // Core voting and election terms
        String[] votingTerms = {
            "vote", "voting", "voter", "ballot", "election", "electoral", "democracy", "democratic",
            "poll", "polling", "candidate", "campaign", "referendum", "primary", "general election",
            "absentee", "early voting", "turnout", "electorate", "constituency", "district",
            "amarvote", "platform", "system", "security", "verification", "guardian", "trustee",
            "electionguard", "cryptographic", "encryption", "results", "tally", "count"
        };
        
        // Check for direct voting/election terms
        for (String term : votingTerms) {
            if (lowerMessage.contains(term)) {
                return true;
            }
        }
        
        // Check for voting-related question patterns
        String[] votingQuestionPatterns = {
            "how.*(?:vote|election|ballot|democracy|candidate)",
            "what.*(?:voting|electoral|election|democracy|ballot)",
            "when.*(?:vote|election|polling|ballot)",
            "where.*(?:vote|polling|election)",
            "who.*(?:vote|candidate|election|win|winner)",
            "why.*(?:vote|voting|election|democracy)",
            "explain.*(?:voting|election|democracy|ballot)",
            "tell me about.*(?:voting|election|democracy|candidate)",
            "how does.*(?:voting|election|democracy|ballot).*work"
        };
        
        for (String pattern : votingQuestionPatterns) {
            if (lowerMessage.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        
        // Check for platform-specific queries
        String[] platformTerms = {
            "create election", "manage election", "election setup", "how to use",
            "account", "login", "signup", "profile", "dashboard", "features",
            "help", "support", "tutorial", "guide", "instructions"
        };
        
        for (String term : platformTerms) {
            if (lowerMessage.contains(term)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Provides detailed voting information for follow-up questions
     */
    private String getDetailedVotingInformation() {
        return "Great! Let me provide you with more detailed information about specific voting methods and technologies:\n\n" +
                "### 🗳️ **Detailed Voting Methods:**\n\n" +
                "**1. Ranked-Choice Voting (RCV)**\n" +
                "• Voters rank candidates in order of preference\n" +
                "• If no candidate gets >50%, lowest vote-getter is eliminated\n" +
                "• Votes redistribute until someone reaches majority\n" +
                "• Used in Maine, Alaska, and many local elections\n\n" +
                
                "**2. Mail-In/Absentee Voting**\n" +
                "• Ballots mailed to registered voters' homes\n" +
                "• Voters fill out and return by mail or drop-off\n" +
                "• Signature verification ensures authenticity\n" +
                "• Some states (like Oregon, Washington) conduct all elections by mail\n\n" +
                
                "**3. Electronic Voting with AmarVote's ElectionGuard**\n" +
                "• **End-to-End Encryption**: Your vote is encrypted immediately\n" +
                "• **Verifiable**: You get a tracking code to verify your vote was counted\n" +
                "• **Privacy-Preserving**: No one can see how you voted, even while proving it was counted\n" +
                "• **Guardian System**: Multiple trustees hold encryption keys - no single point of failure\n\n" +
                
                "### 🔐 **AmarVote's Security Features:**\n\n" +
                "• **Homomorphic Encryption**: Votes can be tallied without decrypting individual ballots\n" +
                "• **Zero-Knowledge Proofs**: Mathematical proof that counting was done correctly\n" +
                "• **Ballot Tracking**: Each voter gets a unique code to verify their vote\n" +
                "• **Public Verification**: Anyone can verify the election integrity\n\n" +
                
                "### 📊 **Election Administration:**\n\n" +
                "• **Voter Registration**: Digital systems with fraud prevention\n" +
                "• **Ballot Design**: User-friendly interfaces with accessibility features\n" +
                "• **Real-Time Monitoring**: Live tracking of voter turnout and system performance\n" +
                "• **Audit Trails**: Complete record of all system activities\n\n" +
                
                "Would you like me to explain any of these topics in more detail? I can dive deeper into:\n" +
                "• How ElectionGuard's encryption works\n" +
                "• Setting up elections on AmarVote\n" +
                "• Different types of election systems (FPTP, proportional representation, etc.)\n" +
                "• Accessibility features in modern voting\n" +
                "• International voting practices";
    }

    private Mono<String> handleGeneralChat(String userMessage, String sessionId) {
        String lowerMessage = userMessage.toLowerCase().trim();
        
        // Check if this is a follow-up response asking for more details
        String[] followUpResponses = {
            "yes", "yeah", "yep", "sure", "ok", "okay", "continue", "tell me more", 
            "more", "go on", "please", "tell me", "explain", "details", "more details",
            "more info", "more information", "elaborate", "expand", "deeper", "dive deeper"
        };
        
        String[] followUpPhrases = {
            "yes.*want.*more", "yes.*want.*deeper", "yes.*want.*dive", "yes.*tell.*more",
            "want.*dive.*deeper", "want.*more.*detail", "want.*know.*more",
            "tell.*more.*about", "explain.*more.*about", "more.*about.*that",
            "dive.*deeper.*into", "go.*deeper.*into", "elaborate.*on.*that"
        };
        
        boolean isFollowUp = false;
        
        // Check for exact follow-up matches
        for (String response : followUpResponses) {
            if (lowerMessage.equals(response) || lowerMessage.equals(response + ".") || 
                lowerMessage.equals(response + "!") || lowerMessage.equals(response + "?")) {
                isFollowUp = true;
                break;
            }
        }
        
        // Check for follow-up phrase patterns
        if (!isFollowUp) {
            for (String phrase : followUpPhrases) {
                if (lowerMessage.matches(".*" + phrase + ".*")) {
                    isFollowUp = true;
                    break;
                }
            }
        }
        
        // If it's a follow-up, provide more detailed voting information
        if (isFollowUp) {
            return Mono.just(getDetailedVotingInformation());
        }
        
        // Create chat messages with session awareness
        List<ChatMessage> messages = new ArrayList<>();
        
        // Add system message with session-aware instructions
        String systemMessage = "You are AmarVote's AI Assistant, specialized exclusively in voting and election topics. " +
                "You MUST only answer questions about: voting systems, electoral processes, election types, " +
                "voting methods, democracy, election administration, ballot design, election security, " +
                "the AmarVote platform features, and ElectionGuard technology. " +
                "Provide comprehensive, helpful responses about voting and election topics. " +
                "Be encouraging and offer to provide more specific details if the user wants to learn more.";
        
        // If we have a sessionId, add session context to system message
        if (sessionId != null && !sessionId.isEmpty()) {
            systemMessage += " This is part of an ongoing conversation. " +
                    "Remember the context from previous questions in this session and provide detailed follow-up responses. " +
                    "If the user is asking for more details or wants to dive deeper, continue from the previous topic discussed. " +
                    "DO NOT mention the session ID or any technical session details in your response.";
        }
        
        ChatMessage userMsg = new ChatMessage("user", userMessage);
        
        messages.add(new ChatMessage("system", systemMessage));
        messages.add(userMsg);

        ChatRequest chatRequest = new ChatRequest("deepseek/deepseek-chat-v3-0324:free", messages);

        return webClient.post()
                .uri(apiUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .header("HTTP-Referer", "https://amarvote2025.me")
                .header("X-Title", "AmarVote-General-Chat-" + (sessionId != null ? sessionId : "default"))
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(chatRequest)
                .retrieve()
                .bodyToMono(String.class)
                .map(json -> {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        JsonNode root = mapper.readTree(json);
                        return root.get("choices").get(0).get("message").get("content").asText();
                    } catch (Exception e) {
                        return "Failed to parse response: " + e.getMessage();
                    }
                });
    }

    private Mono<String> getElectionInfo(String userMessage) {
        try {
            String lowerMessage = userMessage.toLowerCase();
            
            // Check if user is asking for all elections
            if (lowerMessage.contains("all elections") || lowerMessage.contains("all election") ||
                lowerMessage.contains("show all") || lowerMessage.contains("list all") ||
                lowerMessage.contains("show me all") || lowerMessage.contains("result of all")) {
                // Return all public elections
                return Mono.just(electionService.getPublicElectionInfo(""));
            }
            
            // Check if user is asking for recent/latest elections
            if (lowerMessage.contains("recent") || lowerMessage.contains("latest") || 
                lowerMessage.contains("most recent") || lowerMessage.contains("newest") ||
                lowerMessage.contains("last election") || lowerMessage.contains("the last") ||
                lowerMessage.contains("previous election")) {
                // Return the most recent election specifically
                return Mono.just(electionService.getPublicElectionInfo("most recent"));
            }
            
            String potentialElectionName = "";
            
            // Simple heuristic: look for words after "result of", "winner of", etc.
            if (lowerMessage.contains("result of") || lowerMessage.contains("winner of") || 
                lowerMessage.contains("results of") || lowerMessage.contains("outcome of")) {
                String[] words = userMessage.split("\\s+");
                boolean foundTrigger = false;
                StringBuilder nameBuilder = new StringBuilder();
                
                for (String word : words) {
                    if (foundTrigger && !word.toLowerCase().matches("election|vote|voting|results?|winner|outcome|recent|latest|most|newest|last|the|all")) {
                        nameBuilder.append(word).append(" ");
                    }
                    if (word.toLowerCase().matches("of|for")) {
                        foundTrigger = true;
                    }
                }
                potentialElectionName = nameBuilder.toString().trim();
            }
            
            // If we found a potential election name, search for it specifically
            if (!potentialElectionName.isEmpty() && !potentialElectionName.toLowerCase().equals("all")) {
                return Mono.just(electionService.getSpecificElectionInfo(potentialElectionName));
            } else {
                // Otherwise, return general election information (all public elections)
                return Mono.just(electionService.getPublicElectionInfo(""));
            }
            
        } catch (Exception e) {
            return Mono.just("Sorry, I'm having trouble accessing election information right now. Please try again later.");
        }
    }

}
