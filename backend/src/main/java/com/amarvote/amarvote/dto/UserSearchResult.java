package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record UserSearchResult(
        String email,
        String name,
        String source
) {}
