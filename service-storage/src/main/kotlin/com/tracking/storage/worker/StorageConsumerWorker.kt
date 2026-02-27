package com.tracking.storage.worker

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.common.dto.EnrichedFlight
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.PersistableFlight
import com.tracking.storage.model.StorageFailedRecord
import com.tracking.storage.tracing.StorageTraceContextExtractor
import com.tracking.storage.tracing.StorageTraceContextHolder
import org.apache.kafka.clients.consumer.Consumer
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.support.Acknowledgment
import org.springframework.stereotype.Component

@Component
public class StorageConsumerWorker(
    private val objectMapper: ObjectMapper,
    private val batchPersistWorker: BatchPersistWorker,
    private val storageMetrics: StorageMetrics,
    @Value("\${tracking.storage.buffer.pause-threshold:90000}")
    private val pauseThreshold: Int = 90_000,
    @Value("\${tracking.storage.buffer.resume-threshold:50000}")
    private val resumeThreshold: Int = 50_000,
) {
    private val logger = LoggerFactory.getLogger(StorageConsumerWorker::class.java)

    @KafkaListener(
        topics = ["\${tracking.kafka.topics.live:live-adsb}", "\${tracking.kafka.topics.historical:historical-adsb}"],
        groupId = "\${tracking.storage.consumer.group-id:service-storage-v1}",
        containerFactory = "storageKafkaListenerContainerFactory",
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
        val shouldPause = assignment.isNotEmpty() && batchPersistWorker.currentBufferSize() >= pauseThreshold
        if (shouldPause) {
            consumer.pause(assignment)
        }

        try {
            val validRecords: MutableList<PersistableFlight> = mutableListOf()
            val malformedRecords: MutableList<StorageFailedRecord> = mutableListOf()

            records.forEach { record ->
                val traceContext = StorageTraceContextExtractor.extract(record)
                StorageTraceContextHolder.withContext(traceContext) {
                    val payload = record.value()
                    val parsed = runCatching { objectMapper.readValue(payload, EnrichedFlight::class.java) }
                    if (parsed.isSuccess) {
                        validRecords.add(
                            PersistableFlight(
                                flight = parsed.getOrThrow(),
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
                                icao = record.key(),
                                traceContext = traceContext,
                                errorMessage = parsed.exceptionOrNull()?.message,
                            ),
                        )
                    }
                }
            }

            if (validRecords.isNotEmpty()) {
                batchPersistWorker.persistAndFlush(validRecords)
            }
            if (malformedRecords.isNotEmpty()) {
                batchPersistWorker.handleFailedRecords(malformedRecords)
            }

            acknowledgment.acknowledge()
        } finally {
            val pausedPartitions = runCatching { consumer.paused() }.getOrDefault(emptySet())
            val shouldResume = assignment.isNotEmpty() &&
                pausedPartitions.containsAll(assignment) &&
                batchPersistWorker.currentBufferSize() <= resumeThreshold.coerceAtLeast(0)
            if (shouldResume) {
                runCatching { consumer.resume(assignment) }
                    .onFailure { error -> logger.warn("Failed to resume Kafka consumer.", error) }
            }
        }
    }

    private companion object {
        private const val REASON_MALFORMED_PAYLOAD: String = "MALFORMED_PAYLOAD"
    }
}
