package com.amarvote.amarvote.controller;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.service.ApiLogService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private ApiLogService apiLogService;

    @Value("${amarvote.api-logs.allowed-emails:}")
    private String allowedApiLogViewerEmails;

    @GetMapping("/access-check")
    public ResponseEntity<?> checkApiLogAccess() {
        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("allowed", false, "message", "Unauthorized"));
        }

        boolean allowed = isAllowedViewer(currentEmail);
        if (!allowed) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("allowed", false, "message", "Not allowed", "email", currentEmail));
        }

        return ResponseEntity.ok(Map.of("allowed", true, "email", currentEmail));
    }

    /**
     * Get API logs - only accessible by admin
     */
    @GetMapping("/logs")
    public ResponseEntity<?> getApiLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String ip,
            @RequestParam(required = false) String path) {

        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }

        if (!isAllowedViewer(currentEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied. You are not allowed to view API logs.");
        }

        // Get logs based on filters
        Page<ApiLog> logs;
        if (email != null && !email.isEmpty()) {
            logs = apiLogService.getLogsByEmail(email, page, size);
        } else if (ip != null && !ip.isEmpty()) {
            logs = apiLogService.getLogsByIp(ip, page, size);
        } else if (path != null && !path.isEmpty()) {
            logs = apiLogService.getLogsByPath(path, page, size);
        } else {
            logs = apiLogService.getAllLogs(page, size);
        }
        
        return ResponseEntity.ok(logs);
    }

    /**
     * Get API logs statistics
     */
    @GetMapping("/logs/stats")
    public ResponseEntity<?> getLogsStats() {
        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }

        if (!isAllowedViewer(currentEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied. You are not allowed to view API log stats.");
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalLogs", apiLogService.getTotalLogs());
        stats.put("errorLogs", apiLogService.getErrorLogs());
        
        return ResponseEntity.ok(stats);
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

    private boolean isAllowedViewer(String email) {
        if (email == null || email.isBlank()) {
            return false;
        }

        Set<String> allowedSet = parseAllowedEmails();
        return allowedSet.contains(email.trim().toLowerCase());
    }

    private Set<String> parseAllowedEmails() {
        if (allowedApiLogViewerEmails == null || allowedApiLogViewerEmails.isBlank()) {
            return Set.of();
        }

        return java.util.Arrays.stream(allowedApiLogViewerEmails.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toCollection(HashSet::new));
    }
}
