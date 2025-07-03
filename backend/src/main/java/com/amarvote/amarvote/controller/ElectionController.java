package com.amarvote.amarvote.controller;

// ElectionController.java

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.service.ElectionService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;



@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ElectionController {
    private final ElectionService electionService;

    @PostMapping("/create-election")
    public ResponseEntity<Election> createElection(
            @Valid @RequestBody ElectionCreationRequest request,
            HttpServletRequest httpRequest) {
        
        // Get JWT token and user email from request attributes (set by JWTFilter)
        String jwtToken = (String) httpRequest.getAttribute("jwtToken");
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        
        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }
        
        System.out.println("Creating election with JWT: " + jwtToken);
        System.out.println("User email: " + userEmail);
        
        Election election = electionService.createElection(request, jwtToken, userEmail);
        
        if (election == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(election);
    }

    @GetMapping("/all-elections")
    public ResponseEntity<List<ElectionResponse>> getAllElections(HttpServletRequest httpRequest) {
        try {
            // Get user email from request attributes (set by JWTFilter)
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            
            // Alternative: Get user email from Spring Security context
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }
            
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            
            System.out.println("Fetching all accessible elections for user: " + userEmail);
            
            // Get all elections accessible to the user
            List<ElectionResponse> accessibleElections = electionService.getAllAccessibleElections(userEmail);
            
            System.out.println("Found " + accessibleElections.size() + " accessible elections");
            
            return ResponseEntity.ok(accessibleElections);
            
        } catch (Exception e) {
            System.err.println("Error fetching elections: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}