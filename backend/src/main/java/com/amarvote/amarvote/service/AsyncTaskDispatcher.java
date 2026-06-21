package com.amarvote.amarvote.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Runs background work on the Spring task executor.
 * Use this instead of @Async self-invocation (which bypasses the proxy and runs synchronously).
 */
@Service
public class AsyncTaskDispatcher {

    @Async
    public void run(Runnable task) {
        task.run();
    }
}
