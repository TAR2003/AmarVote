package com.amarvote.amarvote.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;

import com.amarvote.amarvote.dto.RAGResponse;
import com.amarvote.amarvote.service.RAGService;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@WebMvcTest(ChatController.class)
public class ChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RAGService ragService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testRAGHealthEndpoint() throws Exception {
        // Mock RAG service health check
        when(ragService.isRAGServiceHealthy()).thenReturn(true);

        mockMvc.perform(MockMvcRequestBuilders.get("/api/rag/health"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().string("RAG service is healthy"));
    }

    @Test
    public void testElectionGuardChatEndpoint() throws Exception {
        // Mock RAG service responses
        when(ragService.isElectionGuardRelated(anyString())).thenReturn(true);
        when(ragService.getRelevantContext(anyString())).thenReturn(
            new RAGResponse("test query", "This is ElectionGuard context about cryptographic voting.")
        );

        String requestBody = "{\"userMessage\": \"What is ElectionGuard?\"}";

        mockMvc.perform(MockMvcRequestBuilders.post("/api/chat/electionguard")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    @Test
    public void testGeneralChatEndpoint() throws Exception {
        String requestBody = "{\"userMessage\": \"Hello, what is AmarVote?\"}";

        mockMvc.perform(MockMvcRequestBuilders.post("/api/chat/general")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    @Test
    public void testElectionGuardChatWithNonElectionGuardQuery() throws Exception {
        // Mock RAG service to return false for non-ElectionGuard queries
        when(ragService.isElectionGuardRelated(anyString())).thenReturn(false);

        String requestBody = "{\"userMessage\": \"What's the weather like?\"}";

        mockMvc.perform(MockMvcRequestBuilders.post("/api/chat/electionguard")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.content().string(
                    "I'm specialized in answering questions about ElectionGuard. " +
                    "Please ask me about ElectionGuard's cryptographic voting system, " +
                    "ballot encryption, verification, or related topics."));
    }
}
