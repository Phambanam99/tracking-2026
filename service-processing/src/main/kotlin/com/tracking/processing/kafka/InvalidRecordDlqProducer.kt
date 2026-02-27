package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextPropagator
import com.tracking.processing.tracing.TraceContextHolder
import java.util.concurrent.TimeUnit
import org.apache.kafka.clients.producer.ProducerRecord
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

public interface InvalidRecordDlqProducer {
    public fun publish(record: InvalidFlightRecord): Unit

    public companion object {
        public const val INVALID_TELEMETRY_DLQ_TOPIC: String = "invalid-telemetry-dlq"
    }
}

public data class InvalidFlightRecord(
    val reason: String,
    val flight: CanonicalFlight,
    val previousFlight: CanonicalFlight? = null,
    val computedSpeedKmh: Double? = null,
)

@Component
public class KafkaInvalidRecordDlqProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val processingMetrics: ProcessingMetrics,
    @Value("\${tracking.kafka.topics.invalidDlq:${InvalidRecordDlqProducer.INVALID_TELEMETRY_DLQ_TOPIC}}")
    private val invalidDlqTopic: String = InvalidRecordDlqProducer.INVALID_TELEMETRY_DLQ_TOPIC,
    @Value("\${tracking.processing.producer.publish-timeout-millis:1000}")
    private val publishTimeoutMillis: Long = 1000,
) : InvalidRecordDlqProducer {
    override fun publish(record: InvalidFlightRecord) {
        val startedAtNanos = System.nanoTime()
        val payload = objectMapper.writeValueAsString(record)
        val kafkaRecord = ProducerRecord(invalidDlqTopic, record.flight.icao, payload)
        KafkaTraceContextPropagator.addTo(kafkaRecord.headers(), TraceContextHolder.current())
        try {
            kafkaTemplate.send(kafkaRecord).get(publishTimeoutMillis, TimeUnit.MILLISECONDS)
            processingMetrics.incrementDlqPublished()
        } finally {
            processingMetrics.recordDlqPublishLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }
}
