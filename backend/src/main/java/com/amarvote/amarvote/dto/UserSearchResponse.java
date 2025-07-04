package com.amarvote.amarvote.dto;

public record UserSearchResponse(
    Integer userId,
    String email,
    String name,
    String profilePic
) {}
