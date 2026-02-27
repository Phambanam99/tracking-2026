package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedFlight
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextPropagator
import com.tracking.processing.tracing.TraceContextHolder
import java.util.concurrent.TimeUnit
import org.apache.kafka.clients.producer.ProducerRecord
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

public interface ProcessingProducer {
    public fun publish(topic: String, flight: EnrichedFlight): Unit
}

@Component
public class KafkaProcessingProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val processingMetrics: ProcessingMetrics,
    @Value("\${tracking.processing.producer.publish-timeout-millis:1000}")
    private val publishTimeoutMillis: Long = 1000,
) : ProcessingProducer {
    override fun publish(topic: String, flight: EnrichedFlight) {
        val startedAtNanos = System.nanoTime()
        val payload = objectMapper.writeValueAsString(flight)
        val record = ProducerRecord(topic, flight.icao, payload)
        KafkaTraceContextPropagator.addTo(record.headers(), TraceContextHolder.current())
        try {
            kafkaTemplate.send(record).get(publishTimeoutMillis, TimeUnit.MILLISECONDS)
        } finally {
            processingMetrics.recordKafkaPublishLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }
}
