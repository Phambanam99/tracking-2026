package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedShip
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextPropagator
import com.tracking.processing.tracing.TraceContextHolder
import org.apache.kafka.clients.producer.ProducerRecord
import org.slf4j.LoggerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

public interface ShipProcessingProducer {
    public fun publish(topic: String, ship: EnrichedShip): Unit
}

@Component
public class KafkaShipProcessingProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val processingMetrics: ProcessingMetrics,
) : ShipProcessingProducer {
    private val logger = LoggerFactory.getLogger(KafkaShipProcessingProducer::class.java)

    override fun publish(topic: String, ship: EnrichedShip) {
        val startedAtNanos = System.nanoTime()
        val payload = objectMapper.writeValueAsString(ship)
        val record = ProducerRecord(topic, ship.mmsi, payload)
        KafkaTraceContextPropagator.addTo(record.headers(), TraceContextHolder.current())
        try {
            kafkaTemplate.send(record)
                .whenComplete { _, error ->
                    if (error == null) {
                        return@whenComplete
                    }

                    processingMetrics.incrementKafkaPublishFailed()
                    logger.warn("Processed ship publish completed exceptionally: topic={}, mmsi={}", topic, ship.mmsi, error)
                }
        } finally {
            processingMetrics.recordKafkaPublishLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }
}
