package com.amarvote.amarvote.service;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.amarvote.amarvote.dto.ElectionProgressEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Server-Sent Events hub for election worker progress.
 * Pushes self-contained snapshots so clients never poll status endpoints.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ElectionProgressStreamService {

    private static final long SSE_TIMEOUT_MS = 30L * 60 * 1000;
    private static final long HEARTBEAT_INTERVAL_SEC = 25L;

    private final ObjectMapper objectMapper;
    private final ElectionProgressSnapshotService snapshotService;
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emittersByElection = new ConcurrentHashMap<>();

    private final ScheduledExecutorService heartbeatScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "election-sse-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    /** Background sends — keeps Tomcat request threads free after subscribe returns. */
    private final ExecutorService sseWorker = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "election-sse-worker");
        thread.setDaemon(true);
        return thread;
    });

    {
        heartbeatScheduler.scheduleAtFixedRate(
            this::sendHeartbeats,
            HEARTBEAT_INTERVAL_SEC,
            HEARTBEAT_INTERVAL_SEC,
            TimeUnit.SECONDS
        );
    }

    public SseEmitter subscribe(Long electionId, String userEmail) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emittersByElection.computeIfAbsent(electionId, id -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(electionId, emitter));
        emitter.onTimeout(() -> removeEmitter(electionId, emitter));
        emitter.onError(ex -> removeEmitter(electionId, emitter));

        try {
            emitter.send(SseEmitter.event()
                .name("connect")
                .data("{\"eventType\":\"connect\"}"));
        } catch (IOException e) {
            removeEmitter(electionId, emitter);
            emitter.completeWithError(e);
            return emitter;
        }

        // Heavy snapshot queries run off the request thread so Tomcat recycles immediately.
        sseWorker.execute(() -> sendSnapshot(emitter, electionId, userEmail));
        return emitter;
    }

    public void publish(ElectionProgressEvent event) {
        if (event == null || event.getElectionId() == null) {
            return;
        }

        ElectionProgressEvent enriched = enrichWithSnapshot(event);
        List<SseEmitter> emitters = emittersByElection.get(enriched.getElectionId());
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name(enriched.getEventType() != null ? enriched.getEventType() : "progress")
                    .data(objectMapper.writeValueAsString(enriched)));
            } catch (Exception e) {
                removeEmitter(enriched.getElectionId(), emitter);
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
            .guardianId(snapshotService.extractGuardianIdFromPayload(payload))
            .payload(payload != null ? payload : Map.of())
            .build());
    }

    private void sendSnapshot(SseEmitter emitter, Long electionId, String userEmail) {
        try {
            Map<String, Object> snapshot = snapshotService.buildFullSnapshot(electionId, userEmail);
            ElectionProgressEvent event = ElectionProgressEvent.builder()
                .electionId(electionId)
                .eventType("snapshot")
                .payload(Map.of("snapshot", snapshot))
                .build();
            emitter.send(SseEmitter.event()
                .name("snapshot")
                .data(objectMapper.writeValueAsString(event)));
        } catch (IOException e) {
            log.warn("Failed to send initial SSE snapshot for election {}", electionId, e);
            removeEmitter(electionId, emitter);
            emitter.completeWithError(e);
        }
    }

    private ElectionProgressEvent enrichWithSnapshot(ElectionProgressEvent event) {
        if ("heartbeat".equals(event.getEventType())) {
            return event;
        }

        Long guardianId = event.getGuardianId();
        if (guardianId == null) {
            guardianId = snapshotService.extractGuardianIdFromPayload(event.getPayload());
        }

        Map<String, Object> snapshot = snapshotService.buildSnapshotForOperation(
            event.getElectionId(),
            event.getOperation(),
            guardianId
        );

        Map<String, Object> payload = event.getPayload() != null
            ? new HashMap<>(event.getPayload())
            : new HashMap<>();
        payload.put("snapshot", snapshot);

        return ElectionProgressEvent.builder()
            .electionId(event.getElectionId())
            .eventType(event.getEventType())
            .operation(event.getOperation())
            .guardianId(guardianId)
            .chunkNumber(event.getChunkNumber())
            .status(event.getStatus())
            .payload(payload)
            .timestamp(event.getTimestamp())
            .build();
    }

    private void sendHeartbeats() {
        emittersByElection.forEach((electionId, emitters) -> {
            if (emitters.isEmpty()) {
                return;
            }
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().comment("heartbeat"));
                } catch (Exception e) {
                    removeEmitter(electionId, emitter);
                    emitter.completeWithError(e);
                }
            }
        });
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

    @PreDestroy
    void shutdown() {
        heartbeatScheduler.shutdownNow();
        sseWorker.shutdownNow();
    }
}
