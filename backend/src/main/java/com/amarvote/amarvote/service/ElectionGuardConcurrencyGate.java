package com.amarvote.amarvote.service;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.amarvote.amarvote.exception.ElectionGuardCapacityException;

/**
 * Limits in-flight ElectionGuard HTTP calls to match Gunicorn worker capacity.
 * Prevents unbounded Tomcat threads from queueing at EG and exhausting DB/HTTP pools.
 */
@Component
public class ElectionGuardConcurrencyGate {

    private final Semaphore apiSemaphore;
    private final Semaphore workerSemaphore;
    private final long apiAcquireTimeoutMs;
    private final long workerAcquireTimeoutMs;

    public ElectionGuardConcurrencyGate(
            @Value("${amarvote.electionguard.api.max-concurrent:6}") int apiMaxConcurrent,
            @Value("${amarvote.electionguard.api.acquire-timeout-ms:180000}") long apiAcquireTimeoutMs,
            @Value("${amarvote.electionguard.worker.max-concurrent:2}") int workerMaxConcurrent,
            @Value("${amarvote.electionguard.worker.acquire-timeout-ms:600000}") long workerAcquireTimeoutMs) {
        this.apiSemaphore = new Semaphore(Math.max(1, apiMaxConcurrent), true);
        this.workerSemaphore = new Semaphore(Math.max(1, workerMaxConcurrent), true);
        this.apiAcquireTimeoutMs = apiAcquireTimeoutMs;
        this.workerAcquireTimeoutMs = workerAcquireTimeoutMs;
    }

    public <T> T executeApi(Supplier<T> action) {
        return execute(apiSemaphore, apiAcquireTimeoutMs, "ElectionGuard API", action);
    }

    public <T> T executeWorker(Supplier<T> action) {
        return execute(workerSemaphore, workerAcquireTimeoutMs, "ElectionGuard worker", action);
    }

    private <T> T execute(Semaphore semaphore, long timeoutMs, String label, Supplier<T> action) {
        boolean acquired = false;
        try {
            acquired = semaphore.tryAcquire(timeoutMs, TimeUnit.MILLISECONDS);
            if (!acquired) {
                throw new ElectionGuardCapacityException(
                        label + " is at capacity. Please retry in a few seconds.");
            }
            return action.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ElectionGuardCapacityException(label + " request interrupted", e);
        } finally {
            if (acquired) {
                semaphore.release();
            }
        }
    }
}
