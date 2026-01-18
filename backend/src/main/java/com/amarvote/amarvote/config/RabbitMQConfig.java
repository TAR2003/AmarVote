package com.amarvote.amarvote.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Configuration for Worker-Based Task Processing
 * 
 * This configuration sets up queues for the 4 main processing tasks:
 * 1. Tally Creation - Process ballot IDs to create encrypted tallies
 * 2. Partial Decryption - Process chunks for guardian decryption
 * 3. Compensated Decryption - Process compensated shares for missing guardians
 * 4. Combine Decryption Shares - Combine all decryption shares
 * 
 * Each queue processes one task at a time (concurrency=1) per unique process identifier
 * to prevent memory accumulation and OOM errors.
 */
@Configuration
public class RabbitMQConfig {

    // Queue Names
    public static final String TALLY_CREATION_QUEUE = "tally.creation.queue";
    public static final String PARTIAL_DECRYPTION_QUEUE = "partial.decryption.queue";
    public static final String COMPENSATED_DECRYPTION_QUEUE = "compensated.decryption.queue";
    public static final String COMBINE_DECRYPTION_QUEUE = "combine.decryption.queue";

    // Exchange Names
    public static final String TASK_EXCHANGE = "task.exchange";

    // Routing Keys
    public static final String TALLY_CREATION_ROUTING_KEY = "task.tally.creation";
    public static final String PARTIAL_DECRYPTION_ROUTING_KEY = "task.partial.decryption";
    public static final String COMPENSATED_DECRYPTION_ROUTING_KEY = "task.compensated.decryption";
    public static final String COMBINE_DECRYPTION_ROUTING_KEY = "task.combine.decryption";

    /**
     * Message converter for JSON serialization/deserialization
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * RabbitTemplate with JSON message converter
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    @Value("${rabbitmq.worker.concurrency.min:4}")
    private int minConcurrentConsumers;
    
    @Value("${rabbitmq.worker.concurrency.max:4}")
    private int maxConcurrentConsumers;

    /**
     * Configure listener container factory with concurrency settings
     * Allow multiple concurrent consumers so different processes can run in parallel
     * (e.g., Guardian 1 and Guardian 2 can decrypt simultaneously)
     * Per-process sequential processing is ensured by lock keys in TaskWorkerService
     * Concurrency values are configurable via application.properties
     */
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        factory.setConcurrentConsumers(minConcurrentConsumers);
        factory.setMaxConcurrentConsumers(maxConcurrentConsumers);
        factory.setPrefetchCount(1); // Each consumer fetches one message at a time
        factory.setDefaultRequeueRejected(false); // Don't requeue on failure
        
        System.out.println("⚙️ RabbitMQ Worker Concurrency configured: min=" + minConcurrentConsumers + ", max=" + maxConcurrentConsumers);
        
        return factory;
    }

    // ========== TASK EXCHANGE ==========
    
    @Bean
    public DirectExchange taskExchange() {
        return new DirectExchange(TASK_EXCHANGE, true, false);
    }

    // ========== TALLY CREATION QUEUE ==========
    
    @Bean
    public Queue tallyCreationQueue() {
        return QueueBuilder.durable(TALLY_CREATION_QUEUE)
            .build();
    }

    @Bean
    public Binding tallyCreationBinding(Queue tallyCreationQueue, DirectExchange taskExchange) {
        return BindingBuilder.bind(tallyCreationQueue)
            .to(taskExchange)
            .with(TALLY_CREATION_ROUTING_KEY);
    }

    // ========== PARTIAL DECRYPTION QUEUE ==========
    
    @Bean
    public Queue partialDecryptionQueue() {
        return QueueBuilder.durable(PARTIAL_DECRYPTION_QUEUE)
            .build();
    }

    @Bean
    public Binding partialDecryptionBinding(Queue partialDecryptionQueue, DirectExchange taskExchange) {
        return BindingBuilder.bind(partialDecryptionQueue)
            .to(taskExchange)
            .with(PARTIAL_DECRYPTION_ROUTING_KEY);
    }

    // ========== COMPENSATED DECRYPTION QUEUE ==========
    
    @Bean
    public Queue compensatedDecryptionQueue() {
        return QueueBuilder.durable(COMPENSATED_DECRYPTION_QUEUE)
            .build();
    }

    @Bean
    public Binding compensatedDecryptionBinding(Queue compensatedDecryptionQueue, DirectExchange taskExchange) {
        return BindingBuilder.bind(compensatedDecryptionQueue)
            .to(taskExchange)
            .with(COMPENSATED_DECRYPTION_ROUTING_KEY);
    }

    // ========== COMBINE DECRYPTION QUEUE ==========
    
    @Bean
    public Queue combineDecryptionQueue() {
        return QueueBuilder.durable(COMBINE_DECRYPTION_QUEUE)
            .build();
    }

    @Bean
    public Binding combineDecryptionBinding(Queue combineDecryptionQueue, DirectExchange taskExchange) {
        return BindingBuilder.bind(combineDecryptionQueue)
            .to(taskExchange)
            .with(COMBINE_DECRYPTION_ROUTING_KEY);
    }
}
