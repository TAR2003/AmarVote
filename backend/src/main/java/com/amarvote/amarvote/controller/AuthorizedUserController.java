package com.amarvote.amarvote.controller;

import java.util.Map;
import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import com.amarvote.amarvote.dto.AuthorizedUserCreateRequestDto;
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

    @GetMapping("/audit-logs")
    public ResponseEntity<?> getAuditLogs() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        try {
            return ResponseEntity.ok(authorizedUserService.getAuditLogs(userEmail));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> addAuthorizedUser(@Valid @RequestBody AuthorizedUserCreateRequestDto request) {
        String actorEmail = getAuthenticatedEmail();
        if (actorEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        try {
            return ResponseEntity.ok(authorizedUserService.addAuthorizedUser(actorEmail, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", ex.getMessage()));
        }
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

    @DeleteMapping("/{authorizedUserId}")
    public ResponseEntity<?> removeAuthorizedUser(@PathVariable Long authorizedUserId) {
        String actorEmail = getAuthenticatedEmail();
        if (actorEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        try {
            return ResponseEntity.ok(authorizedUserService.removeAuthorizedUser(actorEmail, authorizedUserId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/bulk-upload")
    public ResponseEntity<?> bulkUpload(@RequestParam("file") MultipartFile file) {
        String actorEmail = getAuthenticatedEmail();
        if (actorEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        if (file == null || file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Please upload a non-empty CSV file."));
        }

        try {
            String content = new String(file.getBytes());
            return ResponseEntity.ok(authorizedUserService.bulkAddAuthorizedUsers(actorEmail, content));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to process uploaded CSV."));
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