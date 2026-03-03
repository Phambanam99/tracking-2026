package com.tracking.storage.worker

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedShip
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.PersistableShip
import com.tracking.storage.model.StorageFailedRecord
import com.tracking.storage.tracing.StorageTraceContextExtractor
import com.tracking.storage.tracing.StorageTraceContextHolder
import org.apache.kafka.clients.consumer.Consumer
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.support.Acknowledgment
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(
    name = ["tracking.storage.ship.consumer-enabled"],
    havingValue = "true",
)
public class ShipStorageConsumerWorker(
    private val objectMapper: ObjectMapper,
    private val shipBatchPersistWorker: ShipBatchPersistWorker,
    private val storageMetrics: StorageMetrics,
    @Value("\${tracking.storage.buffer.pause-threshold:90000}")
    private val pauseThreshold: Int = 90_000,
    @Value("\${tracking.storage.buffer.resume-threshold:50000}")
    private val resumeThreshold: Int = 50_000,
) {
    private val logger = LoggerFactory.getLogger(ShipStorageConsumerWorker::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.liveAis:live-ais}", "\${tracking.kafka.topics.historicalAis:historical-ais}"],
        groupId = "\${tracking.storage.consumer.group-id:service-storage-v1}",
        containerFactory = "shipStorageKafkaListenerContainerFactory",
        concurrency = "\${tracking.storage.consumer.concurrency:4}",
    )
    public fun consume(
        records: List<ConsumerRecord<String, String>>,
        acknowledgment: Acknowledgment,
        consumer: Consumer<String, String>,
    ): Unit {
        if (records.isEmpty()) {
            return
        }

        val assignment = consumer.assignment()
        val shouldPause = assignment.isNotEmpty() && shipBatchPersistWorker.currentBufferSize() >= pauseThreshold
        if (shouldPause) {
            consumer.pause(assignment)
        }

        val malformedRecords: MutableList<StorageFailedRecord> = mutableListOf()
        try {
            val validRecords: MutableList<PersistableShip> = mutableListOf()

            records.forEach { record ->
                val traceContext = StorageTraceContextExtractor.extract(record)
                StorageTraceContextHolder.withContext(traceContext) {
                    val payload = record.value()
                    val parsed = runCatching { objectMapper.readValue(payload, EnrichedShip::class.java) }
                    if (parsed.isSuccess) {
                        validRecords.add(
                            PersistableShip(
                                ship = parsed.getOrThrow(),
                                sourceTopic = record.topic(),
                                rawPayload = payload,
                                traceContext = traceContext,
                            ),
                        )
                    } else {
                        storageMetrics.incrementMalformedPayload()
                        malformedRecords.add(
                            StorageFailedRecord(
                                reason = REASON_MALFORMED_PAYLOAD,
                                sourceTopic = record.topic(),
                                payload = payload,
                                recordKey = record.key(),
                                traceContext = traceContext,
                                errorMessage = parsed.exceptionOrNull()?.message,
                            ),
                        )
                    }
                }
            }

            if (validRecords.isNotEmpty()) {
                shipBatchPersistWorker.persistAndFlush(validRecords)
            }
            if (malformedRecords.isNotEmpty()) {
                shipBatchPersistWorker.handleFailedRecords(malformedRecords)
            }

            acknowledgment.acknowledge()
        } finally {
            val pausedPartitions = runCatching { consumer.paused() }.getOrDefault(emptySet())
            val shouldResume = assignment.isNotEmpty() &&
                pausedPartitions.containsAll(assignment) &&
                shipBatchPersistWorker.currentBufferSize() <= resumeThreshold.coerceAtLeast(0)
            if (shouldResume) {
                runCatching { consumer.resume(assignment) }
                    .onFailure { error -> logger.warn("Failed to resume ship Kafka consumer.", error) }
            }
        }
    }

    private companion object {
        private const val REASON_MALFORMED_PAYLOAD: String = "MALFORMED_PAYLOAD"
    }
}
