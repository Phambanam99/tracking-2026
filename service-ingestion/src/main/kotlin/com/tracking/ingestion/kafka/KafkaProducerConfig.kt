package com.tracking.ingestion.kafka

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

@Configuration
public class KafkaProducerConfig

@ConfigurationProperties(prefix = "tracking.ingestion.kafka")
public class IngestionKafkaProperties(
    public var publishTimeoutMillis: Long = 1000,
    public var batchPublishConcurrency: Int = 64,
)
