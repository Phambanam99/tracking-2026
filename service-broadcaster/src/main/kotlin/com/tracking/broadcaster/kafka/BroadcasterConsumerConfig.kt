package com.tracking.broadcaster.kafka

import com.tracking.broadcaster.config.BroadcasterProperties
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.util.backoff.FixedBackOff

@Configuration
public class BroadcasterConsumerConfig {
    @Bean
    public fun broadcasterConsumerFactory(
        broadcasterProperties: BroadcasterProperties,
        @Value("\${spring.kafka.bootstrap-servers}")
        bootstrapServers: String,
    ): ConsumerFactory<String, String> {
        val properties: MutableMap<String, Any> = HashMap()
        properties[ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG] = bootstrapServers
        properties[ConsumerConfig.GROUP_ID_CONFIG] = broadcasterProperties.consumer.groupId
        properties[ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG] = StringDeserializer::class.java
        properties[ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG] = StringDeserializer::class.java
        properties[ConsumerConfig.AUTO_OFFSET_RESET_CONFIG] = broadcasterProperties.consumer.autoOffsetReset
        properties[ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG] = true
        properties[ConsumerConfig.MAX_POLL_RECORDS_CONFIG] = broadcasterProperties.consumer.maxPollRecords
        return DefaultKafkaConsumerFactory(properties)
    }

    @Bean
    public fun broadcasterKafkaErrorHandler(
        broadcasterProperties: BroadcasterProperties,
    ): DefaultErrorHandler {
        val retry = broadcasterProperties.consumer.retry
        val maxFailures = (retry.maxAttempts - 1).coerceAtLeast(0)
        return DefaultErrorHandler(FixedBackOff(retry.backoffMillis, maxFailures))
    }

    @Bean
    public fun broadcasterKafkaListenerContainerFactory(
        broadcasterConsumerFactory: ConsumerFactory<String, String>,
        broadcasterKafkaErrorHandler: DefaultErrorHandler,
    ): ConcurrentKafkaListenerContainerFactory<String, String> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, String>()
        factory.consumerFactory = broadcasterConsumerFactory
        factory.setCommonErrorHandler(broadcasterKafkaErrorHandler)
        return factory
    }
}
