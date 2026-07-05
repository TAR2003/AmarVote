package com.amarvote.amarvote.service;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.worker.CombineDecryptionTask;
import com.amarvote.amarvote.dto.worker.CompensatedDecryptionTask;
import com.amarvote.amarvote.dto.worker.EmailTask;
import com.amarvote.amarvote.dto.worker.PartialDecryptionTask;
import com.amarvote.amarvote.dto.worker.TallyCreationTask;
import com.amarvote.amarvote.dto.worker.VoteReceiptTask;
import com.amarvote.amarvote.email.EmailQueueType;

import lombok.RequiredArgsConstructor;

/**
 * Service to publish tasks to RabbitMQ queues
 * This service helps decouple task creation from task execution
 */
@Service
@RequiredArgsConstructor
public class TaskPublisherService {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Publish a tally creation task to the queue
     */
    public void publishTallyCreationTask(TallyCreationTask task) {
        System.out.println("📤 Publishing tally creation task for election " + task.getElectionId() + ", chunk " + task.getChunkNumber());
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.TASK_EXCHANGE,
            RabbitMQConfig.TALLY_CREATION_ROUTING_KEY,
            task
        );
    }

    /**
     * Publish a partial decryption task to the queue
     */
    public void publishPartialDecryptionTask(PartialDecryptionTask task) {
        System.out.println("📤 Publishing partial decryption task for election " + task.getElectionId() + 
                         ", guardian " + task.getGuardianId() + ", chunk " + task.getChunkNumber());
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.TASK_EXCHANGE,
            RabbitMQConfig.PARTIAL_DECRYPTION_ROUTING_KEY,
            task
        );
    }

    /**
     * Publish a compensated decryption task to the queue
     */
    public void publishCompensatedDecryptionTask(CompensatedDecryptionTask task) {
        System.out.println("📤 Publishing compensated decryption task for election " + task.getElectionId() + 
                         ", source guardian " + task.getSourceGuardianId() + 
                         ", target guardian " + task.getTargetGuardianId() + 
                         ", chunk " + task.getChunkNumber());
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.TASK_EXCHANGE,
            RabbitMQConfig.COMPENSATED_DECRYPTION_ROUTING_KEY,
            task
        );
    }

    /**
     * Publish a combine decryption task to the queue
     */
    public void publishCombineDecryptionTask(CombineDecryptionTask task) {
        System.out.println("📤 Publishing combine decryption task for election " + task.getElectionId() + ", chunk " + task.getChunkNumber());
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.TASK_EXCHANGE,
            RabbitMQConfig.COMBINE_DECRYPTION_ROUTING_KEY,
            task
        );
    }

    /**
     * Publish an email task to the correct lane (transactional vs bulk).
     */
    public void publishEmailTask(EmailTask task) {
        if (task.getAttempt() < 0) {
            task.setAttempt(0);
        }
        EmailQueueType lane = resolveEmailQueueType(task);
        String routingKey =
            lane == EmailQueueType.BULK
                ? RabbitMQConfig.EMAIL_BULK_ROUTING_KEY
                : RabbitMQConfig.EMAIL_TRANSACTIONAL_ROUTING_KEY;

        System.out.println("📤 Publishing email task lane=" + lane
                + ", type=" + task.getEmailType()
                + ", to=" + formatRecipient(task)
                + ", attempt=" + task.getAttempt());
        rabbitTemplate.convertAndSend(RabbitMQConfig.TASK_EXCHANGE, routingKey, task);
    }

    public void publishEmailTaskToDlq(EmailTask task) {
        EmailQueueType lane = resolveEmailQueueType(task);
        String routingKey =
            lane == EmailQueueType.BULK
                ? RabbitMQConfig.EMAIL_BULK_DLQ_ROUTING_KEY
                : RabbitMQConfig.EMAIL_TRANSACTIONAL_DLQ_ROUTING_KEY;
        rabbitTemplate.convertAndSend(RabbitMQConfig.EMAIL_DLX, routingKey, task);
    }

    /**
     * Publish vote receipt email task to async queue.
     */
    public void publishVoteReceiptTask(VoteReceiptTask task) {
        EmailTask emailTask = EmailTask.builder()
            .emailType(EmailTask.EmailType.VOTE_RECEIPT)
            .toEmail(task.getVoterEmail())
            .electionId(task.getElectionId())
            .electionTitle(task.getElectionTitle())
            .trackingCode(task.getTrackingCode())
            .receiptContent(task.getReceiptContent())
            .build();
        publishEmailTask(emailTask);
    }

    public static EmailQueueType resolveEmailQueueType(EmailTask task) {
        if (task != null && task.getEmailType() == EmailTask.EmailType.BATCH_REMINDER) {
            return EmailQueueType.BULK;
        }
        return EmailQueueType.TRANSACTIONAL;
    }

    private static String formatRecipient(EmailTask task) {
        if (task.getToEmails() != null && !task.getToEmails().isEmpty()) {
            return task.getToEmails().size() + " recipients (batch)";
        }
        return task.getToEmail();
    }
}
