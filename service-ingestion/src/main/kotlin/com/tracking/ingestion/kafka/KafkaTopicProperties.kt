package com.tracking.ingestion.kafka

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "tracking.kafka.topics")
public class KafkaTopicProperties(
    public var raw: String = "raw-adsb",
    public var rawAis: String = "raw-ais",
    public var authRevocation: String = "auth-revocation",
)
