package com.amarvote.amarvote.service;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.worker.EmailTask;

import lombok.RequiredArgsConstructor;

/**
 * Periodically drains email dead-letter queues and re-publishes tasks that
 * have not yet exhausted their delivery attempt budget.
 */
@Service
@RequiredArgsConstructor
public class EmailDlqReprocessor {

    private final RabbitTemplate rabbitTemplate;
    private final TaskPublisherService taskPublisherService;

    @Value("${amarvote.email.max-attempts:5}")
    private int maxAttempts;

    @Value("${amarvote.email.dlq-retry-batch-size:50}")
    private int batchSize;

    @Scheduled(fixedDelayString = "${amarvote.email.dlq-retry-interval-ms:300000}")
    public void reprocessDeadLetters() {
        int processed = 0;

        while (processed < batchSize) {
            Object payload =
                    rabbitTemplate.receiveAndConvert(RabbitMQConfig.EMAIL_TRANSACTIONAL_DLQ, 250);
            if (payload == null) {
                payload = rabbitTemplate.receiveAndConvert(RabbitMQConfig.EMAIL_BULK_DLQ, 250);
            }
            if (!(payload instanceof EmailTask task)) {
                break;
            }

            processed++;
            int nextAttempt = task.getAttempt() + 1;

            if (nextAttempt >= maxAttempts) {
                System.err.println("❌ Email permanently failed after " + maxAttempts
                        + " attempts — type=" + task.getEmailType()
                        + ", to=" + formatRecipient(task)
                        + ", electionId=" + task.getElectionId());
                continue;
            }

            task.setAttempt(nextAttempt);
            taskPublisherService.publishEmailTask(task);
            System.out.println("♻️ Re-queued email from DLQ (attempt " + nextAttempt + "/"
                    + maxAttempts + ") — type=" + task.getEmailType() + ", to=" + formatRecipient(task));
        }

        if (processed > 0) {
            System.out.println("📬 Email DLQ reprocessor handled " + processed + " message(s)");
        }
    }

    private static String formatRecipient(EmailTask task) {
        if (task.getToEmails() != null && !task.getToEmails().isEmpty()) {
            return task.getToEmails().size() + " recipients (batch)";
        }
        return task.getToEmail();
    }
}
