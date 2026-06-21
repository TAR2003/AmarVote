package com.amarvote.amarvote.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.amarvote.amarvote.service.ApiLogService;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class ApiLogMaintenanceTask implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ApiLogMaintenanceTask.class);

    private final ApiLogService apiLogService;

    @Override
    public void run(ApplicationArguments args) {
        int scrubbed = apiLogService.scrubSensitiveFields();
        if (scrubbed > 0) {
            log.info("Scrubbed sensitive fields from {} legacy api_logs row(s)", scrubbed);
        }
    }

    @Scheduled(cron = "${amarvote.api-logging.purge-cron:0 0 3 * * *}")
    public void purgeExpiredLogs() {
        int deleted = apiLogService.purgeLogsOlderThanRetention();
        if (deleted > 0) {
            log.info("Purged {} api_logs row(s) past retention window", deleted);
        }
    }
}
