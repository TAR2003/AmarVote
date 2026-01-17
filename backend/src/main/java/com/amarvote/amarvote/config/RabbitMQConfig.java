package com.amarvote.amarvote.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ Configuration for Tier 3 Message Queue System
 * 
 * This configuration defines:
 * - Queues: Where messages wait to be processed
 * - Exchanges: Route messages to appropriate queues
 * - Bindings: Connect exchanges to queues with routing keys
 * - Message Converter: Serialize/deserialize messages as JSON
 */
@Configuration
public class RabbitMQConfig {

    // ========== QUEUE NAMES ==========
    public static final String TALLY_QUEUE = "tally.queue";
    public static final String DECRYPTION_QUEUE = "decryption.queue";
    public static final String COMBINE_QUEUE = "combine.queue";
    public static final String COMPENSATED_DECRYPTION_QUEUE = "compensated.decryption.queue";
    
    // ========== EXCHANGE NAMES ==========
    public static final String ELECTION_EXCHANGE = "election.exchange";
    
    // ========== ROUTING KEYS ==========
    public static final String TALLY_ROUTING_KEY = "election.tally";
    public static final String DECRYPTION_ROUTING_KEY = "election.decryption";
    public static final String COMBINE_ROUTING_KEY = "election.combine";
    public static final String COMPENSATED_DECRYPTION_ROUTING_KEY = "election.compensated.decryption";

    // ========== QUEUE DEFINITIONS ==========
    
    @Bean
    public Queue tallyQueue() {
        return QueueBuilder.durable(TALLY_QUEUE)
                .withArgument("x-message-ttl", 3600000) // 1 hour TTL
                .withArgument("x-max-length", 100000)    // Max 100k messages
                .build();
    }

    @Bean
    public Queue decryptionQueue() {
        return QueueBuilder.durable(DECRYPTION_QUEUE)
                .withArgument("x-message-ttl", 3600000)
                .withArgument("x-max-length", 100000)
                .build();
    }

    @Bean
    public Queue combineQueue() {
        return QueueBuilder.durable(COMBINE_QUEUE)
                .withArgument("x-message-ttl", 3600000)
                .withArgument("x-max-length", 100000)
                .build();
    }

    @Bean
    public Queue compensatedDecryptionQueue() {
        return QueueBuilder.durable(COMPENSATED_DECRYPTION_QUEUE)
                .withArgument("x-message-ttl", 3600000)
                .withArgument("x-max-length", 100000)
                .build();
    }

    // ========== EXCHANGE DEFINITION ==========
    
    @Bean
    public TopicExchange electionExchange() {
        return new TopicExchange(ELECTION_EXCHANGE, true, false);
    }

    // ========== BINDINGS ==========
    
    @Bean
    public Binding tallyBinding(Queue tallyQueue, TopicExchange electionExchange) {
        return BindingBuilder.bind(tallyQueue)
                .to(electionExchange)
                .with(TALLY_ROUTING_KEY);
    }

    @Bean
    public Binding decryptionBinding(Queue decryptionQueue, TopicExchange electionExchange) {
        return BindingBuilder.bind(decryptionQueue)
                .to(electionExchange)
                .with(DECRYPTION_ROUTING_KEY);
    }

    @Bean
    public Binding combineBinding(Queue combineQueue, TopicExchange electionExchange) {
        return BindingBuilder.bind(combineQueue)
                .to(electionExchange)
                .with(COMBINE_ROUTING_KEY);
    }

    @Bean
    public Binding compensatedDecryptionBinding(Queue compensatedDecryptionQueue, TopicExchange electionExchange) {
        return BindingBuilder.bind(compensatedDecryptionQueue)
                .to(electionExchange)
                .with(COMPENSATED_DECRYPTION_ROUTING_KEY);
    }

    // ========== MESSAGE CONVERTER ==========
    
    /**
     * Convert messages to/from JSON using Jackson
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * Configure RabbitTemplate with JSON converter
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    /**
     * Configure listener container for workers
     * 
     * NOTE: Concurrency settings here are DEFAULT values.
     * They are OVERRIDDEN by profile-specific properties:
     * 
     * API Profile (application-api.properties):
     * - spring.rabbitmq.listener.simple.auto-startup=false (listeners disabled)
     * 
     * Worker Profile (application-worker.properties):
     * - spring.rabbitmq.listener.simple.concurrency=1 (ONE chunk at a time)
     * - spring.rabbitmq.listener.simple.max-concurrency=1 (NO scaling)
     * - spring.rabbitmq.listener.simple.prefetch=1 (ONE message at a time)
     * 
     * This ensures:
     * - API servers don't consume messages
     * - Workers process exactly ONE chunk at a time
     * - Memory usage is bounded and predictable
     */
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        // Default values (overridden by application-worker.properties)
        factory.setPrefetchCount(1);
        factory.setConcurrentConsumers(1);
        factory.setMaxConcurrentConsumers(1);
        factory.setDefaultRequeueRejected(true);
        return factory;
    }
}
