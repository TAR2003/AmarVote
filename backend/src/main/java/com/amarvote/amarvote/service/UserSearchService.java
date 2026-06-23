package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.UserSearchResult;
import com.amarvote.amarvote.model.AppUser;
import com.amarvote.amarvote.model.AuthorizedUser;
import com.amarvote.amarvote.repository.AppUserRepository;
import com.amarvote.amarvote.repository.AuthorizedUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserSearchService {

    private static final int MAX_RESULTS = 10;

    private final AppUserRepository appUserRepository;
    private final AuthorizedUserRepository authorizedUserRepository;

    public List<UserSearchResult> searchUsers(String query) {
        if (query == null || query.trim().length() < 2) {
            return List.of();
        }

        String normalizedQuery = query.trim().toLowerCase();
        Map<String, UserSearchResult> merged = new LinkedHashMap<>();

        authorizedUserRepository
                .findByEmailContainingIgnoreCaseOrderByEmailAsc(
                        normalizedQuery, PageRequest.of(0, MAX_RESULTS))
                .forEach((AuthorizedUser user) -> addResult(merged, user.getEmail(), user.getEmail(), "authorized"));

        appUserRepository
                .findTop10ByEmailContainingIgnoreCaseOrderByEmailAsc(normalizedQuery)
                .forEach((AppUser user) -> addResult(merged, user.getEmail(), user.getEmail(), "registered"));

        return new ArrayList<>(merged.values()).stream().limit(MAX_RESULTS).toList();
    }

    private void addResult(Map<String, UserSearchResult> merged, String email, String name, String source) {
        if (email == null || email.isBlank()) {
            return;
        }
        String key = email.trim().toLowerCase();
        merged.putIfAbsent(key, UserSearchResult.builder()
                .email(key)
                .name(name)
                .source(source)
                .build());
    }
}
