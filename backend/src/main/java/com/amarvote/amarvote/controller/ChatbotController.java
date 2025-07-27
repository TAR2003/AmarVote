package com.amarvote.amarvote.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import com.amarvote.amarvote.dto.ChatMessage;
import com.amarvote.amarvote.dto.ChatRequest;
import com.amarvote.amarvote.dto.UserChatRequest;
import com.amarvote.amarvote.service.ElectionService;
import com.amarvote.amarvote.service.RAGService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.netty.channel.ChannelOption;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

/**
 * New clean chatbot controller implementing the four main query categories:
 * 1. AmarVote User Guide queries (how to create election, vote, verify, see results)
 * 2. ElectionGuard technical queries (guardians, encryption, decryption, proofs)
 * 3. Election results queries (recent elections, specific election results)
 * 4. General election-related chat (fallback for other election topics)
 */
@RestController
@RequestMapping("/api/chatbot")
public class ChatbotController {

    private static final Logger logger = LoggerFactory.getLogger(ChatbotController.class);

    @Value("${deepseek.api.key}")
    private String apiKey;

    @Value("${deepseek.api.url}")
    private String apiUrl;

    @Autowired
    private RAGService ragService;

    @Autowired
    private ElectionService electionService;

    private final WebClient webClient;
    
    // Session management for conversation context
    private final Map<String, ConversationSession> sessionStore = new ConcurrentHashMap<>();

    public ChatbotController() {
        // Configure HttpClient with timeouts
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000)
                .responseTimeout(java.time.Duration.ofSeconds(120));

        this.webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    /**
     * Main chat endpoint with intelligent query routing
     */
    @PostMapping("/chat")
    public Mono<String> chat(@RequestBody UserChatRequest request) {
        String userMessage = request.getUserMessage();
        String sessionId = request.getSessionId();
        
        // Validate input
        if (userMessage == null || userMessage.trim().isEmpty()) {
            return Mono.just("Please ask me a question about elections, voting, or the AmarVote platform.");
        }

        // Clean and normalize the message
        String cleanMessage = userMessage.trim();
        
        // Get or create session for context management
        ConversationSession session = getOrCreateSession(sessionId);
        session.addUserMessage(cleanMessage);
        
        // Classify query intent based on the requirements
        QueryIntent intent = classifyQueryIntent(cleanMessage);
        
        // Route to appropriate handler
        return handleQuery(intent, cleanMessage, session)
                .doOnNext(response -> {
                    session.addBotResponse(response);
                    logger.info("Successfully processed query with intent: {}", intent);
                })
                .doOnError(error -> {
                    logger.error("Error processing query with intent {}: {}", intent, error.getMessage(), error);
                    session.addBotResponse("I apologize, but I encountered an error. Please try again.");
                });
    }

    /**
     * Query intent classification based on the four main categories
     */
    private enum QueryIntent {
        AMARVOTE_USER_GUIDE,    // How to create election, vote, verify, see results
        ELECTIONGUARD_TECHNICAL, // ElectionGuard terminology and technical concepts
        ELECTION_RESULTS,       // Show election results, recent elections
        GENERAL_ELECTION,       // Other election-related topics
        OFF_TOPIC              // Non-election related queries
    }

    /**
     * Intelligent query classification based on requirements
     */
    private QueryIntent classifyQueryIntent(String message) {
        String lowerMessage = message.toLowerCase().trim();
        
        // 1. Check for AmarVote User Guide queries first (highest priority for platform usage)
        if (isAmarVoteUserGuideQuery(lowerMessage)) {
            return QueryIntent.AMARVOTE_USER_GUIDE;
        }
        
        // 2. Check for Election Results queries
        if (isElectionResultsQuery(lowerMessage)) {
            return QueryIntent.ELECTION_RESULTS;
        }
        
        // 3. Check for ElectionGuard technical queries
        if (isElectionGuardQuery(lowerMessage)) {
            return QueryIntent.ELECTIONGUARD_TECHNICAL;
        }
        
        // 4. Check if it's election-related for general chat
        if (isElectionRelated(lowerMessage)) {
            return QueryIntent.GENERAL_ELECTION;
        }
        
        // 5. Not election-related
        return QueryIntent.OFF_TOPIC;
    }

    /**
     * Check if query is about AmarVote platform usage (User Guide category)
     */
    private boolean isAmarVoteUserGuideQuery(String message) {
        // Patterns for creating elections
        String[] createElectionPatterns = {
            "how.*create.*election", "create.*election", "creating.*election",
            "steps.*create.*election", "process.*creating.*election",
            "election.*creation", "setup.*election", "new.*election"
        };
        
        // Patterns for voting
        String[] votingPatterns = {
            "how.*cast.*vote", "how.*vote.*election", "voting.*process",
            "cast.*vote", "submit.*vote", "vote.*ballot", "how.*vote"
        };
        
        // Patterns for verification
        String[] verificationPatterns = {
            "how.*verify.*vote", "verify.*vote.*counted", "check.*vote.*counted",
            "verification.*vote", "vote.*verification", "verify.*ballot",
            "confirm.*vote", "validate.*vote", "tracking.*code", "track.*vote", "vote.*tracking"
        };
        
        // Patterns for seeing results
        String[] resultsViewPatterns = {
            "how.*see.*result", "view.*result", "check.*result",
            "access.*result", "find.*result", "where.*result"
        };
        
        // Check all pattern categories
        return matchesAnyPattern(message, createElectionPatterns) ||
               matchesAnyPattern(message, votingPatterns) ||
               matchesAnyPattern(message, verificationPatterns) ||
               matchesAnyPattern(message, resultsViewPatterns);
    }

    /**
     * Check if query is about ElectionGuard technical concepts
     */
    private boolean isElectionGuardQuery(String message) {
        // ElectionGuard-specific terms from the requirements
        String[] electionGuardTerms = {
            "electionguard", "guardian", "trustee", "key ceremony", "quorum",
            "ballot.*encrypt", "encryption.*algorithm", "decrypt", "partial.*decrypt",
            "zero.*knowledge.*proof", "chaum.*pedersen", "elgamal",
            "homomorphic.*encryption", "cryptographic", "verification.*ballot"
        };
        
        // Questions about ElectionGuard workings
        String[] electionGuardPatterns = {
            "what.*electionguard", "how.*electionguard.*work", "what.*guardian.*mean",
            "what.*key.*ceremony", "how.*ballot.*encrypt", "how.*decrypt",
            "what.*partial.*decrypt", "what.*zero.*knowledge.*proof",
            "why.*verification", "how.*ballot.*verification","tell.*encrypt", 
            "tell.*encryption", "explain.*encryption", "encryption.*technique", "what.*encryption.*technique",
            "say.*encryption", "know.*encryption"

        };
        
        return containsAnyTerm(message, electionGuardTerms) ||
               matchesAnyPattern(message, electionGuardPatterns);
    }

    /**
     * Check if query is asking for election results
     */
    private boolean isElectionResultsQuery(String message) {
        // Result-specific patterns
        String[] resultPatterns = {
            "result.*recent.*election", "result.*latest.*election", "result.*most.*recent",
            "show.*result.*election", "result.*all.*election", "all.*election.*result",
            "result.*election.*\".*\"", "result.*\".*\".*election"
        };
        
        // Keywords that indicate result queries
        String[] resultKeywords = {
            "result", "winner", "outcome", "tally", "count", "votes"
        };
        
        // Time-based result queries
        String[] timeBasedPatterns = {
            "recent.*election", "latest.*election", "last.*election",
            "newest.*election", "current.*election", "completed.*election"
        };
        
        return matchesAnyPattern(message, resultPatterns) ||
               isElectionStartTimeQuery(message) ||  // Include start time queries here
               (containsAnyTerm(message, resultKeywords) && 
                (containsAnyTerm(message, new String[]{"election", "voting"}) ||
                 matchesAnyPattern(message, timeBasedPatterns)));
    }

    /**
     * Check if query is election-related but not in the specific categories above
     */
    private boolean isElectionRelated(String message) {
        String[] electionTerms = {
            "election", "voting", "vote", "voter", "ballot", "democracy", "democratic",
            "candidate", "campaign", "referendum", "poll", "polling", "electoral"
        };
        
        return containsAnyTerm(message, electionTerms);
    }

    /**
     * Route query to appropriate handler based on intent
     */
    private Mono<String> handleQuery(QueryIntent intent, String message, ConversationSession session) {
        switch (intent) {
            case AMARVOTE_USER_GUIDE:
                return handleAmarVoteUserGuideQuery(message, session);
            
            case ELECTIONGUARD_TECHNICAL:
                return handleElectionGuardQuery(message, session);
            
            case ELECTION_RESULTS:
                return handleElectionResultsQuery(message, session);
            
            case GENERAL_ELECTION:
                return handleGeneralElectionQuery(message, session);
            
            case OFF_TOPIC:
            default:
                return handleOffTopicQuery(message, session);
        }
    }

    /**
     * Handle AmarVote User Guide queries using RAG
     */
    private Mono<String> handleAmarVoteUserGuideQuery(String message, ConversationSession session) {
        logger.info("Processing AmarVote User Guide query: {}", message);
        return Mono.fromCallable(() -> {
            try {
                logger.info("Calling RAG service for AmarVote platform context");
                return ragService.getAmarVotePlatformContext(message);
            } catch (Exception e) {
                logger.error("Error calling RAG service: {}", e.getMessage(), e);
                throw e;
            }
        })
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .flatMap(ragResponse -> {
                    logger.info("RAG response received - success: {}, context length: {}", 
                               ragResponse.isSuccess(), ragResponse.getContext().length());
                    if (!ragResponse.isSuccess() || ragResponse.getContext().isEmpty()) {
                        return Mono.just("I'm sorry, I couldn't access the AmarVote user guide right now. " +
                                "Please try again later or contact support for assistance with platform usage.");
                    }

                    logger.info("Generating AI response with context");
                    return generateAIResponse(message, ragResponse.getContext(), session, 
                            "AmarVote Platform Assistant", 
                            "Answer questions about using the AmarVote platform based on the user guide. " +
                            "Provide clear, step-by-step instructions for creating elections, voting, " +
                            "verification, and viewing results. Be specific and user-friendly.");
                });
    }

    /**
     * Handle ElectionGuard technical queries using RAG
     */
    private Mono<String> handleElectionGuardQuery(String message, ConversationSession session) {
        return Mono.fromCallable(() -> ragService.getRelevantContext(message, 2000, "EG_spec_2_1"))
                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                .flatMap(ragResponse -> {
                    if (!ragResponse.isSuccess() || ragResponse.getContext().isEmpty()) {
                        return Mono.just("I'm sorry, I couldn't access the ElectionGuard specification right now. " +
                                "Please try again later for technical questions about ElectionGuard.");
                    }

                    return generateAIResponse(message, ragResponse.getContext(), session,
                            "ElectionGuard Technical Expert",
                            "Answer technical questions about ElectionGuard based on the specification. " +
                            "Explain concepts like guardians, key ceremonies, encryption algorithms, " +
                            "decryption processes, zero-knowledge proofs, and ballot verification clearly.");
                });
    }

    /**
     * Handle election results queries using database
     */
    private Mono<String> handleElectionResultsQuery(String message, ConversationSession session) {
        return Mono.fromCallable(() -> {
            try {
                String lowerMessage = message.toLowerCase();
                
                // Check if asking for election start time first
                if (isElectionStartTimeQuery(lowerMessage)) {
                    return handleElectionStartTimeQuery(message);
                }
                
                // Parse query type for results
                if (containsAnyTerm(lowerMessage, new String[]{"all", "list all", "show all"})) {
                    // Show all public elections (max 5 as per requirements)
                    String result = electionService.getPublicElectionInfo("");
                    return result != null ? result : "No public elections found.";
                } else if (containsAnyTerm(lowerMessage, new String[]{"recent", "latest", "last", "newest", "most recent"})) {
                    // Show most recent election specifically
                    String result = getMostRecentElectionOnly();
                    return result != null ? result : "No recent public elections found.";
                } else {
                    // Try to extract election name from quotes or context
                    String electionName = extractElectionName(message);
                    if (electionName != null) {
                        String result = electionService.getSpecificElectionInfo(electionName);
                        return result != null ? result : "Election '" + electionName + "' not found or not accessible.";
                    } else {
                        // Default to recent elections
                        String result = getMostRecentElectionOnly();
                        return result != null ? result : "No public elections found.";
                    }
                }
            } catch (Exception e) {
                return "I encountered an error while retrieving election information. " +
                        "Please ensure the election is public or you have access to view its results.";
            }
        })
        .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic());
    }
    
    /**
     * Check if query is about election start time
     */
    private boolean isElectionStartTimeQuery(String message) {
        String[] startTimePatterns = {
            "when.*election.*start", "when.*election.*begin", "start.*time.*election",
            "when.*\".*\".*election.*start", "when.*does.*election.*start",
            "what.*time.*election.*start", "election.*start.*date", "election.*start.*time"
        };
        return matchesAnyPattern(message, startTimePatterns);
    }
    
    /**
     * Handle election start time queries
     */
    private String handleElectionStartTimeQuery(String message) {
        try {
            String electionName = extractElectionName(message);
            
            if (electionName != null) {
                // Get specific election start time
                return electionService.getElectionStartTimeInfo(electionName);
            } else {
                // Return general information about finding election start times
                return "To check when a specific election starts, please provide the election name in quotes. " +
                        "For example: 'When does the \"Student Council Election\" start?'\n\n" +
                        "You can also browse available elections and their schedules in the elections section.";
            }
        } catch (Exception e) {
            return "I couldn't retrieve the election start time information. " +
                    "Please make sure the election exists and is public or you have access to it.";
        }
    }
    
    /**
     * Get only the most recent election (not all elections)
     */
    private String getMostRecentElectionOnly() {
        try {
            // The ElectionService already handles "recent" queries correctly
            String result = electionService.getPublicElectionInfo("recent");
            return result != null ? result : "No recent public elections found.";
        } catch (Exception e) {
            return "No recent public elections found.";
        }
    }

    /**
     * Handle general election-related queries using DeepSeek
     */
    private Mono<String> handleGeneralElectionQuery(String message, ConversationSession session) {
        return generateAIResponse(message, null, session,
                "AmarVote Election Assistant",
                "You are AmarVote's specialized election assistant. Answer questions about " +
                "voting systems, electoral processes, democracy, election administration, " +
                "and general election topics. Provide educational and helpful information " +
                "while staying focused on election-related subjects.");
    }

    /**
     * Handle off-topic queries with appropriate boundaries
     */
    private Mono<String> handleOffTopicQuery(String message, ConversationSession session) {
        return Mono.just("""
                I'm AmarVote's specialized chatbot focused on elections and voting. \
                I can help you with:
                
                • **Platform Usage**: How to create elections, vote, verify votes, and view results
                • **ElectionGuard Technology**: Technical details about our security system
                • **Election Results**: Information about completed elections
                • **General Election Topics**: Voting systems, democracy, and electoral processes
                
                Please ask me something related to elections, voting, or the AmarVote platform!""");
    }

    /**
     * Generate AI response using DeepSeek with context and session awareness
     */
    private Mono<String> generateAIResponse(String userMessage, String context, ConversationSession session, 
                                          String assistantRole, String systemPrompt) {
        List<ChatMessage> messages = new ArrayList<>();
        
        // Add system message with role and context
        String fullSystemPrompt = "You are " + assistantRole + ". " + systemPrompt;
        
        // Add session context if available
        if (session.hasContext()) {
            fullSystemPrompt += " This is an ongoing conversation. Previous context: " +
                    session.getRecentContext();
        }
        
        // Add document context if provided
        if (context != null && !context.trim().isEmpty()) {
            fullSystemPrompt += "\n\nRelevant information:\n" + context;
        }
        
        fullSystemPrompt += """
                
                IMPORTANT FORMATTING INSTRUCTIONS:
                - Use proper markdown formatting for all responses
                - Use ## for main sections (not ###)
                - Use **bold text** for emphasis and important terms
                - Use numbered lists (1. 2. 3.) for step-by-step instructions
                - Use bullet points (-) for feature lists
                - Use > for important quotes or examples
                - Separate sections with single blank lines (not --- separators)
                - Keep responses well-structured and easy to read
                - Use proper indentation for sub-items
                - Make sure all markdown syntax is correct and will render properly
                
                MATHEMATICAL NOTATION INSTRUCTIONS:
                - For subscripts, use HTML tags: κ<sub>i</sub>, ζ<sub>i</sub>, a<sub>i,j</sub>
                - For superscripts, use HTML tags: x<sup>2</sup>, a<sup>n</sup>
                - Use actual Greek letters: κ, ζ, γ, α, β, δ, ε, θ, λ, μ, π, σ, τ, φ, ω
                - Do NOT use underscore notation like κ_i or a_{i,j}
                - Do NOT use caret notation like x^2
                - Always use proper HTML subscript/superscript tags for mathematical expressions
                
                Provide clear, well-formatted responses using proper markdown and HTML mathematical notation. \
                Be helpful, accurate, and focused on the user's question.""";
        
        messages.add(new ChatMessage("system", fullSystemPrompt));
        messages.add(new ChatMessage("user", userMessage));
        
        ChatRequest chatRequest = new ChatRequest("deepseek/deepseek-chat-v3-0324:free", messages);
        
        return webClient.post()
                .uri(apiUrl)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .header("HTTP-Referer", "https://amarvote2025.me")
                .header("X-Title", "AmarVote-Chatbot-" + session.getSessionId())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(chatRequest)
                .retrieve()
                .bodyToMono(String.class)
                .doOnNext(response -> logger.info("DeepSeek API response received successfully"))
                .doOnError(error -> logger.error("DeepSeek API call failed: {}", error.getMessage(), error))
                .map(this::parseAIResponse)
                .onErrorReturn("I apologize, but I'm having trouble processing your request right now. Please try again.");
    }

    /**
     * Parse AI response from JSON
     */
    private String parseAIResponse(String jsonResponse) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonResponse);
            String content = root.get("choices").get(0).get("message").get("content").asText();
            return cleanResponse(content);
        } catch (Exception e) {
            return "I apologize for the error in processing the response.";
        }
    }

    /**
     * Clean and format the response
     */
    private String cleanResponse(String response) {
        return response.trim()
                // Only clean up leading/trailing unwanted characters
                .replaceAll("^[,:\\s]+", "")
                // Fix multiple periods
                .replaceAll("\\s*\\.\\s*\\.", ".")
                // Fix multiple commas
                .replaceAll("\\s*,\\s*,", ",");
    }

    // Helper methods for pattern matching
    private boolean matchesAnyPattern(String text, String[] patterns) {
        for (String pattern : patterns) {
            if (text.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        return false;
    }

    private boolean containsAnyTerm(String text, String[] terms) {
        for (String term : terms) {
            if (text.contains(term)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Extract election name from message (looking for quoted strings)
     */
    private String extractElectionName(String message) {
        // Look for quoted election names (both single and double quotes)
        if (message.contains("\"")) {
            int start = message.indexOf("\"");
            int end = message.indexOf("\"", start + 1);
            if (end > start) {
                return message.substring(start + 1, end);
            }
        }
        
        if (message.contains("'")) {
            int start = message.indexOf("'");
            int end = message.indexOf("'", start + 1);
            if (end > start) {
                return message.substring(start + 1, end);
            }
        }
        
        // Look for patterns like "election named X", "election called X", etc.
        String[] patterns = {
            "election\\s+named\\s+([\\w\\s]+?)(?:\\s|$|\\?|\\.|,)",
            "election\\s+called\\s+([\\w\\s]+?)(?:\\s|$|\\?|\\.|,)",
            "election\\s+titled\\s+([\\w\\s]+?)(?:\\s|$|\\?|\\.|,)",
            "for\\s+election\\s+([\\w\\s]+?)(?:\\s|$|\\?|\\.|,)"
        };
        
        for (String pattern : patterns) {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern, java.util.regex.Pattern.CASE_INSENSITIVE);
            java.util.regex.Matcher m = p.matcher(message);
            if (m.find()) {
                return m.group(1).trim();
            }
        }
        
        return null;
    }

    /**
     * Get or create conversation session
     */
    private ConversationSession getOrCreateSession(String sessionId) {
        if (sessionId == null || sessionId.trim().isEmpty()) {
            sessionId = "default-" + System.currentTimeMillis();
        }
        
        return sessionStore.computeIfAbsent(sessionId, id -> new ConversationSession(id));
    }

    /**
     * Inner class for session management
     */
    private static class ConversationSession {
        private final String sessionId;
        private final List<String> conversationHistory;
        private static final int MAX_HISTORY_SIZE = 10;
        
        public ConversationSession(String sessionId) {
            this.sessionId = sessionId;
            this.conversationHistory = new ArrayList<>();
        }
        
        public void addUserMessage(String message) {
            addToHistory("User: " + message);
        }
        
        public void addBotResponse(String response) {
            addToHistory("Bot: " + response);
        }
        
        private void addToHistory(String entry) {
            conversationHistory.add(entry);
            // Keep only recent history to avoid context overflow
            if (conversationHistory.size() > MAX_HISTORY_SIZE) {
                conversationHistory.remove(0);
            }
        }
        
        public boolean hasContext() {
            return conversationHistory.size() > 2; // More than just current exchange
        }
        
        public String getRecentContext() {
            if (conversationHistory.size() <= 2) {
                return "";
            }
            // Return last few exchanges for context
            int start = Math.max(0, conversationHistory.size() - 6);
            return String.join("\n", conversationHistory.subList(start, conversationHistory.size() - 1));
        }
        
        public String getSessionId() {
            return sessionId;
        }
    }
}
