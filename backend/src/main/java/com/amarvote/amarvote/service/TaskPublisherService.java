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
     * Publish a generic email task to the dedicated email queue.
     */
    public void publishEmailTask(EmailTask task) {
        System.out.println("📤 Publishing email task type=" + task.getEmailType() + ", to=" + task.getToEmail());
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.TASK_EXCHANGE,
            RabbitMQConfig.EMAIL_ROUTING_KEY,
            task
        );
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
}
