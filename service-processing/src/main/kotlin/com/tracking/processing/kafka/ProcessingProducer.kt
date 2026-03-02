package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedFlight
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextPropagator
import com.tracking.processing.tracing.TraceContextHolder
import org.apache.kafka.clients.producer.ProducerRecord
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import org.slf4j.LoggerFactory

public interface ProcessingProducer {
    public fun publish(topic: String, flight: EnrichedFlight): Unit
}

@Component
public class KafkaProcessingProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val processingMetrics: ProcessingMetrics,
) : ProcessingProducer {
    private val logger = LoggerFactory.getLogger(KafkaProcessingProducer::class.java)

    override fun publish(topic: String, flight: EnrichedFlight) {
        val startedAtNanos = System.nanoTime()
        val payload = objectMapper.writeValueAsString(flight)
        val record = ProducerRecord(topic, flight.icao, payload)
        KafkaTraceContextPropagator.addTo(record.headers(), TraceContextHolder.current())
        try {
            // Preserve partition ordering while avoiding per-record broker round-trips on the hot path.
            kafkaTemplate.send(record)
                .whenComplete { _, error ->
                    if (error == null) {
                        return@whenComplete
                    }

                    processingMetrics.incrementKafkaPublishFailed()
                    logger.warn("Processed flight publish completed exceptionally: topic={}, icao={}", topic, flight.icao, error)
                }
        } finally {
            processingMetrics.recordKafkaPublishLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }
}
