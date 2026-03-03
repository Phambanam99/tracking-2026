package com.tracking.processing.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.CanonicalShip
import com.tracking.processing.engine.ShipProcessor
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.tracing.KafkaTraceContextExtractor
import com.tracking.processing.tracing.ProcessingTraceContext
import com.tracking.processing.tracing.TraceContextHolder
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(prefix = "tracking.processing.ship", name = ["consumer-enabled"], havingValue = "true")
public class RawAisConsumer(
    private val objectMapper: ObjectMapper,
    private val shipProcessor: ShipProcessor,
    private val invalidRecordDlqProducer: ShipInvalidRecordDlqProducer,
    private val processingMetrics: ProcessingMetrics,
    @Value("\${tracking.processing.ship.strict-key-match:true}")
    private val strictKeyMatch: Boolean = true,
) {
    private val logger = LoggerFactory.getLogger(RawAisConsumer::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.rawAis:raw-ais}"],
        groupId = "\${tracking.processing.consumer.group-id:\${spring.application.name}-v1}-ship",
        concurrency = "\${tracking.processing.consumer.concurrency:8}",
    )
    public fun consume(record: ConsumerRecord<String, String>): Unit {
        consume(
            key = record.key(),
            payload = record.value(),
            traceContext = KafkaTraceContextExtractor.extract(record),
        )
    }

    public fun consume(
        key: String?,
        payload: String,
        traceContext: ProcessingTraceContext = ProcessingTraceContext(),
    ): Unit {
        processingMetrics.incrementRawConsumed()

        TraceContextHolder.withContext(traceContext) {
            val ship = runCatching { objectMapper.readValue(payload, CanonicalShip::class.java) }
                .getOrElse { error ->
                    processingMetrics.incrementMalformedPayload()
                    logger.warn("Ignore malformed payload from raw ship topic: payload={}", payload, error)
                    return@withContext
                }

            if (strictKeyMatch && key != null && key.isNotBlank() && key != ship.mmsi) {
                processingMetrics.incrementKeyMismatch()
                invalidRecordDlqProducer.publish(
                    InvalidShipRecord(
                        reason = KEY_MMSI_MISMATCH_REASON,
                        ship = ship,
                    ),
                )
                return@withContext
            }

            shipProcessor.process(ship)
        }
    }

    private companion object {
        private const val KEY_MMSI_MISMATCH_REASON: String = "KEY_MMSI_MISMATCH"
    }
}
