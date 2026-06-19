package com.amarvote.amarvote.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.amarvote.amarvote.service.ElectionProgressStreamService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/elections")
@RequiredArgsConstructor
public class ElectionProgressStreamController {

    private final ElectionProgressStreamService progressStreamService;

    @GetMapping(value = "/{electionId}/progress/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamProgress(@PathVariable Long electionId) {
        return progressStreamService.subscribe(electionId);
    }
}
