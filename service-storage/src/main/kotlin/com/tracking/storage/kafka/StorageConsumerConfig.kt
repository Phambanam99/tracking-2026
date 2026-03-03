package com.tracking.storage.kafka

import com.tracking.storage.buffer.FlightBuffer
import com.tracking.storage.buffer.ShipBuffer
import com.tracking.storage.retry.StorageRetryPolicy
import com.tracking.storage.worker.BatchPersistWorker
import com.tracking.storage.worker.ShipBatchPersistWorker
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.TopicPartition
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.listener.ContainerProperties
import org.springframework.kafka.listener.ConsumerAwareRebalanceListener
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.util.backoff.FixedBackOff

@Configuration
public class StorageConsumerConfig {
    @Bean
    public fun flightBuffer(
        @Value("\${tracking.storage.buffer.max-capacity:100000}")
        maxCapacity: Int,
    ): FlightBuffer = FlightBuffer(maxCapacity = maxCapacity)

    @Bean
    public fun shipBuffer(
        @Value("\${tracking.storage.buffer.max-capacity:100000}")
        maxCapacity: Int,
    ): ShipBuffer = ShipBuffer(maxCapacity = maxCapacity)

    @Bean
    public fun storageRetryPolicy(
        @Value("\${tracking.storage.retry.delays-millis:0,1000,3000}")
        delays: String,
    ): StorageRetryPolicy {
        val parsedDelays = delays.split(',')
            .mapNotNull { token -> token.trim().toLongOrNull() }
            .ifEmpty { listOf(0L, 1_000L, 3_000L) }
        return StorageRetryPolicy(retryDelaysMillis = parsedDelays)
    }

    @Bean
    public fun storageConsumerFactory(
        @Value("\${spring.kafka.bootstrap-servers}")
        bootstrapServers: String,
        @Value("\${tracking.storage.consumer.group-id:service-storage-v1}")
        groupId: String,
        @Value("\${tracking.storage.consumer.auto-offset-reset:latest}")
        autoOffsetReset: String,
        @Value("\${tracking.storage.batch.max-size:5000}")
        maxPollRecords: Int,
    ): ConsumerFactory<String, String> {
        val properties: MutableMap<String, Any> = HashMap()
        properties[ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG] = bootstrapServers
        properties[ConsumerConfig.GROUP_ID_CONFIG] = groupId
        properties[ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG] = StringDeserializer::class.java
        properties[ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG] = StringDeserializer::class.java
        properties[ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG] = false
        properties[ConsumerConfig.AUTO_OFFSET_RESET_CONFIG] = autoOffsetReset
        properties[ConsumerConfig.MAX_POLL_RECORDS_CONFIG] = maxPollRecords
        return DefaultKafkaConsumerFactory(properties)
    }

    @Bean
    public fun storageKafkaListenerContainerFactory(
        storageConsumerFactory: ConsumerFactory<String, String>,
        batchPersistWorker: BatchPersistWorker,
        @Value("\${tracking.storage.consumer.poll-timeout-millis:5000}")
        pollTimeoutMillis: Long,
        @Value("\${tracking.storage.consumer.retry.backoff-millis:1000}")
        retryBackoffMillis: Long,
        @Value("\${tracking.storage.consumer.retry.max-attempts:3}")
        retryMaxAttempts: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, String>()
        factory.consumerFactory = storageConsumerFactory
        factory.setBatchListener(true)
        factory.containerProperties.ackMode = ContainerProperties.AckMode.MANUAL_IMMEDIATE
        factory.containerProperties.pollTimeout = pollTimeoutMillis

        val attempts = (retryMaxAttempts - 1).coerceAtLeast(0)
        factory.setCommonErrorHandler(DefaultErrorHandler(FixedBackOff(retryBackoffMillis, attempts)))

        factory.containerProperties.setConsumerRebalanceListener(object : ConsumerAwareRebalanceListener {
            override fun onPartitionsRevokedBeforeCommit(
                consumer: org.apache.kafka.clients.consumer.Consumer<*, *>,
                partitions: MutableCollection<TopicPartition>,
            ) {
                batchPersistWorker.flushOnPartitionsRevoked()
            }
        })

        return factory
    }

    @Bean
    public fun shipStorageKafkaListenerContainerFactory(
        storageConsumerFactory: ConsumerFactory<String, String>,
        shipBatchPersistWorker: ShipBatchPersistWorker,
        @Value("\${tracking.storage.consumer.poll-timeout-millis:5000}")
        pollTimeoutMillis: Long,
        @Value("\${tracking.storage.consumer.retry.backoff-millis:1000}")
        retryBackoffMillis: Long,
        @Value("\${tracking.storage.consumer.retry.max-attempts:3}")
        retryMaxAttempts: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, String>()
        factory.consumerFactory = storageConsumerFactory
        factory.setBatchListener(true)
        factory.containerProperties.ackMode = ContainerProperties.AckMode.MANUAL_IMMEDIATE
        factory.containerProperties.pollTimeout = pollTimeoutMillis

        val attempts = (retryMaxAttempts - 1).coerceAtLeast(0)
        factory.setCommonErrorHandler(DefaultErrorHandler(FixedBackOff(retryBackoffMillis, attempts)))

        factory.containerProperties.setConsumerRebalanceListener(object : ConsumerAwareRebalanceListener {
            override fun onPartitionsRevokedBeforeCommit(
                consumer: org.apache.kafka.clients.consumer.Consumer<*, *>,
                partitions: MutableCollection<TopicPartition>,
            ) {
                shipBatchPersistWorker.flushOnPartitionsRevoked()
            }
        })

        return factory
    }
}
