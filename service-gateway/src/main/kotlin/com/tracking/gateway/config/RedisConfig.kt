package com.tracking.gateway.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory
import org.springframework.data.redis.core.ReactiveStringRedisTemplate

@Configuration
public class RedisConfig {
    @Bean
    public fun reactiveStringRedisTemplate(
        connectionFactory: ReactiveRedisConnectionFactory,
    ): ReactiveStringRedisTemplate {
        return ReactiveStringRedisTemplate(connectionFactory)
    }
}
