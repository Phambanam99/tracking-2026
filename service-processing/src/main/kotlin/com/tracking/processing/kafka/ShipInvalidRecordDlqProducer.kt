package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalShip
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextPropagator
import com.tracking.processing.tracing.TraceContextHolder
import org.apache.kafka.clients.producer.ProducerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

public interface ShipInvalidRecordDlqProducer {
    public fun publish(record: InvalidShipRecord): Unit
}

public data class InvalidShipRecord(
    val reason: String,
    val ship: CanonicalShip,
    val previousShip: CanonicalShip? = null,
    val computedSpeedKmh: Double? = null,
)

@Component
public class KafkaShipInvalidRecordDlqProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val processingMetrics: ProcessingMetrics,
    @Value("\${tracking.kafka.topics.invalidDlq:${InvalidRecordDlqProducer.INVALID_TELEMETRY_DLQ_TOPIC}}")
    private val invalidDlqTopic: String = InvalidRecordDlqProducer.INVALID_TELEMETRY_DLQ_TOPIC,
) : ShipInvalidRecordDlqProducer {
    private val logger = LoggerFactory.getLogger(KafkaShipInvalidRecordDlqProducer::class.java)

    override fun publish(record: InvalidShipRecord) {
        val startedAtNanos = System.nanoTime()
        val payload = objectMapper.writeValueAsString(record)
        val kafkaRecord = ProducerRecord(invalidDlqTopic, record.ship.mmsi, payload)
        KafkaTraceContextPropagator.addTo(kafkaRecord.headers(), TraceContextHolder.current())
        try {
            kafkaTemplate.send(kafkaRecord)
                .whenComplete { _, error ->
                    if (error == null) {
                        processingMetrics.incrementDlqPublished()
                        return@whenComplete
                    }

                    processingMetrics.incrementDlqPublishFailed()
                    logger.warn("Ship DLQ publish completed exceptionally: mmsi={}", record.ship.mmsi, error)
                }
        } finally {
            processingMetrics.recordDlqPublishLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }
}
