package com.amarvote.amarvote.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.UserSearchResponse;
import com.amarvote.amarvote.service.UserSearchService;

@RestController
@RequestMapping("/api/users")
public class UserSearchController {

    @Autowired
    private UserSearchService userSearchService;

    @GetMapping("/search")
    public ResponseEntity<List<UserSearchResponse>> searchUsers(@RequestParam String query) {
        List<UserSearchResponse> users = userSearchService.searchUsersByEmailOrName(query);
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getUserCount() {
        long count = userSearchService.getUserCount();
        return ResponseEntity.ok(Map.of("count", count));
    }
}
