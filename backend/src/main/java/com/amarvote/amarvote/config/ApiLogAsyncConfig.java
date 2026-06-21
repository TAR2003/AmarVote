package com.amarvote.amarvote.config;

import java.util.concurrent.Executor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class ApiLogAsyncConfig {

    @Bean(name = "apiLogExecutor")
    public Executor apiLogExecutor(
            @Value("${amarvote.api-logging.async.core-pool-size:2}") int corePoolSize,
            @Value("${amarvote.api-logging.async.max-pool-size:6}") int maxPoolSize,
            @Value("${amarvote.api-logging.async.queue-capacity:8192}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("api-log-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
