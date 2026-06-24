package com.amarvote.amarvote.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.UserSearchResult;
import com.amarvote.amarvote.service.UserSearchService;
import com.amarvote.amarvote.service.UserStatsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserSearchService userSearchService;
    private final UserStatsService userStatsService;

    @GetMapping("/search")
    public ResponseEntity<List<UserSearchResult>> searchUsers(@RequestParam String query) {
        return ResponseEntity.ok(userSearchService.searchUsers(query));
    }

    @GetMapping("/count")
    public ResponseEntity<java.util.Map<String, Long>> getUserCount() {
        java.util.Map<String, Long> stats = userStatsService.getUserStats();
        return ResponseEntity.ok(java.util.Map.of("count", stats.get("registeredUsers")));
    }

    @GetMapping("/stats")
    public ResponseEntity<java.util.Map<String, Long>> getUserStats() {
        return ResponseEntity.ok(userStatsService.getUserStats());
    }
}
