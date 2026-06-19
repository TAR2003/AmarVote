package com.amarvote.amarvote.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.amarvote.amarvote.service.ElectionProgressStreamService;
import com.amarvote.amarvote.service.ElectionService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/elections")
@RequiredArgsConstructor
public class ElectionProgressStreamController {

    private final ElectionProgressStreamService progressStreamService;
    private final ElectionService electionService;

    @GetMapping(value = "/{electionId}/progress/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamProgress(@PathVariable Long electionId) {
        String userEmail = resolveAuthenticatedEmail();
        if (userEmail == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (!electionService.canUserViewElection(electionId, userEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to view this election");
        }
        return progressStreamService.subscribe(electionId, userEmail);
    }

    private String resolveAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        String name = authentication.getName();
        if (name == null || "anonymousUser".equals(name)) {
            return null;
        }
        return name.trim().toLowerCase();
    }
}
