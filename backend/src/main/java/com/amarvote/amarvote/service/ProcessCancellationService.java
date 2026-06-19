package com.amarvote.amarvote.service;

import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.model.ProcessOperationType;

import lombok.RequiredArgsConstructor;

/**
 * Redis-backed cancellation flags for long-running election worker pipelines.
 * Workers and the chunk dispatcher check these before publishing or processing work.
 */
@Service
@RequiredArgsConstructor
public class ProcessCancellationService {

    private static final String KEY_PREFIX = "process:cancel:";
    private static final long TTL_HOURS = 48;

    private final RedisTemplate<String, String> redisTemplate;

    public void requestStop(Long electionId, ProcessOperationType operation, Long guardianId) {
        redisTemplate.opsForValue().set(
            buildKey(electionId, operation, guardianId),
            "1",
            TTL_HOURS,
            TimeUnit.HOURS
        );
    }

    public void clearStop(Long electionId, ProcessOperationType operation, Long guardianId) {
        redisTemplate.delete(buildKey(electionId, operation, guardianId));
    }

    public boolean isStopped(Long electionId, ProcessOperationType operation, Long guardianId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(electionId, operation, guardianId)));
    }

    public boolean isTallyStopped(Long electionId) {
        return isStopped(electionId, ProcessOperationType.TALLY, null);
    }

    public boolean isCombineStopped(Long electionId) {
        return isStopped(electionId, ProcessOperationType.COMBINE, null);
    }

    public boolean isGuardianDecryptionStopped(Long electionId, Long guardianId) {
        return isStopped(electionId, ProcessOperationType.PARTIAL_DECRYPTION, guardianId)
            || isStopped(electionId, ProcessOperationType.COMPENSATED_DECRYPTION, guardianId);
    }

    private String buildKey(Long electionId, ProcessOperationType operation, Long guardianId) {
        StringBuilder key = new StringBuilder(KEY_PREFIX)
            .append(electionId)
            .append(':')
            .append(operation.name());
        if (guardianId != null) {
            key.append(':').append(guardianId);
        }
        return key.toString();
    }
}
