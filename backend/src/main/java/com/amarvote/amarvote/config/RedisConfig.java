package com.amarvote.amarvote.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis configuration for secure temporary credential storage.
 * 
 * Redis provides in-memory storage with automatic expiration (TTL),
 * making it ideal for temporary sensitive data that should not be persisted to disk.
 * 
 * Security benefits:
 * - Data stored in memory (not persisted by default)
 * - Automatic expiration prevents credential leakage
 * - Can be configured with encryption in transit (TLS/SSL)
 * - Access control through authentication
 */
@Configuration
public class RedisConfig {

    /**
     * Configure RedisTemplate for storing guardian credentials temporarily.
     * Uses String serializers for both keys and values for simplicity and security.
     */
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        // Use String serializers for both key and value
        // This prevents Java serialization vulnerabilities
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setValueSerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setHashValueSerializer(stringSerializer);
        
        template.afterPropertiesSet();
        return template;
    }
}
