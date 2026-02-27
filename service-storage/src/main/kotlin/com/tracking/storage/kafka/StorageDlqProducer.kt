package com.tracking.storage.kafka

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.StorageFailedRecord
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.concurrent.TimeUnit
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.header.internals.RecordHeader
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

public interface StorageDlqProducer {
    public fun publish(records: List<StorageFailedRecord>): Unit
}

public data class StorageDlqMessage(
    val reason: String,
    val sourceTopic: String,
    val payload: String,
    val icao: String? = null,
    val errorMessage: String? = null,
    val occurredAt: String = Instant.now().toString(),
)

@Component
public class KafkaStorageDlqProducer(
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val objectMapper: ObjectMapper,
    private val storageMetrics: StorageMetrics,
    @Value("\${tracking.kafka.topics.storageDlq:storage-dlq}")
    private val storageDlqTopic: String = "storage-dlq",
    @Value("\${tracking.storage.dlq.publish-timeout-millis:1000}")
    private val publishTimeoutMillis: Long = 1000,
) : StorageDlqProducer {
    override fun publish(records: List<StorageFailedRecord>) {
        if (records.isEmpty()) {
            return
        }

        records.forEach { record ->
            val message = StorageDlqMessage(
                reason = record.reason,
                sourceTopic = record.sourceTopic,
                payload = record.payload,
                icao = record.icao,
                errorMessage = record.errorMessage,
                occurredAt = record.occurredAt.toString(),
            )
            val payload = objectMapper.writeValueAsString(message)
            val key = record.icao ?: "unknown"
            val kafkaRecord = ProducerRecord(storageDlqTopic, key, payload)
            addHeader(kafkaRecord, "x-request-id", record.traceContext.requestId)
            addHeader(kafkaRecord, "traceparent", record.traceContext.traceparent)
            kafkaTemplate.send(kafkaRecord).get(publishTimeoutMillis, TimeUnit.MILLISECONDS)
        }

        storageMetrics.incrementDlqPublished()
    }

    private fun addHeader(record: ProducerRecord<String, String>, key: String, value: String?): Unit {
        val normalized = value?.trim().orEmpty()
        if (normalized.isEmpty()) {
            return
        }

        record.headers().remove(key)
        record.headers().add(RecordHeader(key, normalized.toByteArray(StandardCharsets.UTF_8)))
    }
}
