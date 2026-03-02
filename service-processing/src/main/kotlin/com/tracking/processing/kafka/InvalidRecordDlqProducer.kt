package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalFlight
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextPropagator
import com.tracking.processing.tracing.TraceContextHolder
import org.apache.kafka.clients.producer.ProducerRecord
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component
import org.slf4j.LoggerFactory

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
) : InvalidRecordDlqProducer {
    private val logger = LoggerFactory.getLogger(KafkaInvalidRecordDlqProducer::class.java)

    override fun publish(record: InvalidFlightRecord) {
        val startedAtNanos = System.nanoTime()
        val payload = objectMapper.writeValueAsString(record)
        val kafkaRecord = ProducerRecord(invalidDlqTopic, record.flight.icao, payload)
        KafkaTraceContextPropagator.addTo(kafkaRecord.headers(), TraceContextHolder.current())
        try {
            kafkaTemplate.send(kafkaRecord)
                .whenComplete { _, error ->
                    if (error == null) {
                        processingMetrics.incrementDlqPublished()
                        return@whenComplete
                    }

                    processingMetrics.incrementDlqPublishFailed()
                    logger.warn("DLQ publish completed exceptionally: icao={}", record.flight.icao, error)
                }
        } finally {
            processingMetrics.recordDlqPublishLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }
}
