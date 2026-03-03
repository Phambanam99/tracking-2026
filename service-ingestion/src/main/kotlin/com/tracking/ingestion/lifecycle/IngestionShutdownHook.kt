package com.tracking.ingestion.lifecycle

import com.tracking.ingestion.kafka.RawAdsbProducer
import com.tracking.ingestion.kafka.RawAisProducer
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
public class IngestionShutdownHook(
    private val rawAdsbProducer: RawAdsbProducer,
    private val rawAisProducer: RawAisProducer,
) {
    private val logger = LoggerFactory.getLogger(IngestionShutdownHook::class.java)

    @PreDestroy
    public fun flushKafkaProducerBuffer() {
        logger.info("Flushing Kafka producer buffer before shutdown")
        rawAdsbProducer.flush()
        rawAisProducer.flush()
    }
}
