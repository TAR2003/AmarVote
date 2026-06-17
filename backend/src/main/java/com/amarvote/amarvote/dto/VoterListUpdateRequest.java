package com.amarvote.amarvote.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;

public record VoterListUpdateRequest(
    @NotEmpty List<String> voterEmails
) {}
