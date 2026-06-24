package com.amarvote.amarvote.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.BulkDeleteRequestDto;
import com.amarvote.amarvote.service.ApiLogService;
import com.amarvote.amarvote.service.AuthorizedUserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private ApiLogService apiLogService;

    @Autowired
    private AuthorizedUserService authorizedUserService;

    @GetMapping("/access-check")
    public ResponseEntity<?> checkApiLogAccess() {
        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("allowed", false, "message", "Unauthorized"));
        }

        boolean allowed = authorizedUserService.canViewApiLogs(currentEmail);
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
            @RequestParam(defaultValue = "all") String view,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String ip,
            @RequestParam(required = false) String path) {

        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }

        if (!authorizedUserService.canViewApiLogs(currentEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied. You are not allowed to view API logs.");
        }

        return ResponseEntity.ok(apiLogService.getLogs(view, page, size, email, ip, path));
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

        if (!authorizedUserService.canViewApiLogs(currentEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied. You are not allowed to view API log stats.");
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalLogs", apiLogService.getTotalLogs());
        stats.put("errorLogs", apiLogService.getErrorLogs());
        
        return ResponseEntity.ok(stats);
    }

    @DeleteMapping("/logs")
    public ResponseEntity<?> deleteApiLogs(@Valid @RequestBody BulkDeleteRequestDto request) {
        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }

        if (!authorizedUserService.canViewApiLogs(currentEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Access denied. You are not allowed to delete API logs."));
        }

        int deleted = apiLogService.deleteLogsByIds(request.getIds());
        return ResponseEntity.ok(Map.of("deleted", deleted));
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
