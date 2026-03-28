package com.amarvote.amarvote.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.AuthorizedUserUpdateRequestDto;
import com.amarvote.amarvote.service.AuthorizedUserService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/authorized-users")
@RequiredArgsConstructor
@Validated
public class AuthorizedUserController {

    private final AuthorizedUserService authorizedUserService;

    @GetMapping("/me")
    public ResponseEntity<?> myAccess() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        return ResponseEntity.ok(authorizedUserService.getCurrentUserAccess(userEmail));
    }

    @GetMapping
    public ResponseEntity<?> listAuthorizedUsers() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        return ResponseEntity.ok(authorizedUserService.getAuthorizedUsers(userEmail));
    }

    @PutMapping("/{authorizedUserId}")
    public ResponseEntity<?> updateAuthorizedUser(
            @PathVariable Long authorizedUserId,
            @Valid @RequestBody AuthorizedUserUpdateRequestDto request) {

        String actorEmail = getAuthenticatedEmail();
        if (actorEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        try {
            return ResponseEntity.ok(authorizedUserService.updateAuthorizedUser(actorEmail, authorizedUserId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    private String getAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        return authentication.getName();
    }
}