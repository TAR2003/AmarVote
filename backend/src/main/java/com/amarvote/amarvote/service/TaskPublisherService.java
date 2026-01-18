package com.amarvote.amarvote.service;

import com.amarvote.amarvote.config.RabbitMQConfig;
import com.amarvote.amarvote.dto.worker.*;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

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
}
