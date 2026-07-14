package com.amarvote.amarvote.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.service.AnalyticsService;
import com.amarvote.amarvote.service.AuthorizedUserService;

import lombok.RequiredArgsConstructor;

/**
 * Read-only traffic analytics endpoints backed by api_logs + geo cache.
 * Admin/owner only (same gate as API Logs).
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final AuthorizedUserService authorizedUserService;

    @GetMapping("/locations")
    public ResponseEntity<?> locations(
            @RequestParam(defaultValue = "today") String scope,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        ResponseEntity<?> denied = denyUnlessCanView();
        if (denied != null) {
            return denied;
        }
        return ResponseEntity.ok(analyticsService.getLocations(scope, from, to));
    }

    @GetMapping("/timeseries")
    public ResponseEntity<?> timeseries(
            @RequestParam(defaultValue = "today") String scope,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String ip) {
        ResponseEntity<?> denied = denyUnlessCanView();
        if (denied != null) {
            return denied;
        }
        return ResponseEntity.ok(analyticsService.getTimeseries(scope, from, to, ip));
    }

    @GetMapping("/sessions")
    public ResponseEntity<?> sessions(
            @RequestParam(defaultValue = "today") String scope,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        ResponseEntity<?> denied = denyUnlessCanView();
        if (denied != null) {
            return denied;
        }
        return ResponseEntity.ok(analyticsService.getSessions(scope, from, to));
    }

    private ResponseEntity<?> denyUnlessCanView() {
        String currentEmail = getAuthenticatedEmail();
        if (currentEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }
        if (!authorizedUserService.canViewApiLogs(currentEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Access denied. Admin or owner privileges required."));
        }
        return null;
    }

    private String getAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        return null;
    }
}
