package com.amarvote.amarvote.service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.amarvote.amarvote.dto.ElectionProgressEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Server-Sent Events hub for election worker progress.
 * Replaces frequent HTTP polling from the frontend.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ElectionProgressStreamService {

    private static final long SSE_TIMEOUT_MS = 30L * 60 * 1000;

    private final ObjectMapper objectMapper;
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emittersByElection = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long electionId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emittersByElection.computeIfAbsent(electionId, id -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(electionId, emitter));
        emitter.onTimeout(() -> removeEmitter(electionId, emitter));
        emitter.onError(ex -> removeEmitter(electionId, emitter));

        try {
            emitter.send(SseEmitter.event()
                .name("connected")
                .data(Map.of("electionId", electionId, "message", "subscribed")));
        } catch (IOException e) {
            removeEmitter(electionId, emitter);
            emitter.completeWithError(e);
        }

        return emitter;
    }

    public void publish(ElectionProgressEvent event) {
        if (event == null || event.getElectionId() == null) {
            return;
        }
        List<SseEmitter> emitters = emittersByElection.get(event.getElectionId());
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name(event.getEventType() != null ? event.getEventType() : "progress")
                    .data(objectMapper.writeValueAsString(event)));
            } catch (Exception e) {
                removeEmitter(event.getElectionId(), emitter);
                emitter.completeWithError(e);
            }
        }
    }

    public void publishProgress(Long electionId, String operation, String status, Map<String, Object> payload) {
        publish(ElectionProgressEvent.builder()
            .electionId(electionId)
            .eventType("progress")
            .operation(operation)
            .status(status)
            .payload(payload)
            .build());
    }

    private void removeEmitter(Long electionId, SseEmitter emitter) {
        List<SseEmitter> emitters = emittersByElection.get(electionId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                emittersByElection.remove(electionId);
            }
        }
    }
}
