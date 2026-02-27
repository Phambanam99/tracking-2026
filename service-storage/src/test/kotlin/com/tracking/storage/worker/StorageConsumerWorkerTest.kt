package com.tracking.storage.worker

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.common.dto.EnrichedFlight
import com.tracking.storage.buffer.FlightBuffer
import com.tracking.storage.db.StorageBatchWriter
import com.tracking.storage.kafka.StorageDlqProducer
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.PersistableFlight
import com.tracking.storage.model.StorageFailedRecord
import com.tracking.storage.retry.StorageRetryPolicy
import io.kotest.matchers.collections.shouldHaveSize
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.apache.kafka.clients.consumer.Consumer
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.common.TopicPartition
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.kafka.support.Acknowledgment

public class StorageConsumerWorkerTest {
    @Test
    public fun `should persist valid records and quarantine malformed payloads then acknowledge`() {
        val writer = RecordingStorageBatchWriter()
        val dlqProducer = RecordingDlqProducer()
        val metrics = StorageMetrics(SimpleMeterRegistry())
        val batchPersistWorker = BatchPersistWorker(
            flightBuffer = FlightBuffer(maxCapacity = 10_000),
            jdbcBatchWriter = writer,
            storageRetryPolicy = StorageRetryPolicy(listOf(0L)),
            storageDlqProducer = dlqProducer,
            storageMetrics = metrics,
            batchSize = 5000,
            flushIntervalMillis = 5000,
        )
        val worker = StorageConsumerWorker(
            objectMapper = jacksonObjectMapper(),
            batchPersistWorker = batchPersistWorker,
            storageMetrics = metrics,
            pauseThreshold = 10,
            resumeThreshold = 5,
        )

        val records = listOf(
            ConsumerRecord("live-adsb", 0, 1L, "ABC123", validPayload()),
            ConsumerRecord("live-adsb", 0, 2L, "ABC999", "{not-json"),
        )
        val acknowledgment = Mockito.mock(Acknowledgment::class.java)
        @Suppress("UNCHECKED_CAST")
        val consumer = Mockito.mock(Consumer::class.java) as Consumer<String, String>
        val assignment = setOf(TopicPartition("live-adsb", 0))
        Mockito.`when`(consumer.assignment()).thenReturn(assignment)
        Mockito.`when`(consumer.paused()).thenReturn(emptySet())

        worker.consume(records, acknowledgment, consumer)

        writer.writtenBatches shouldHaveSize 1
        writer.writtenBatches.first() shouldHaveSize 1
        writer.quarantineBatches shouldHaveSize 1
        writer.quarantineBatches.first() shouldHaveSize 1
        dlqProducer.published shouldHaveSize 1
        dlqProducer.published.first() shouldHaveSize 1
        Mockito.verify(acknowledgment).acknowledge()
    }

    @Test
    public fun `should resume consumer when it is paused and buffer is below resume threshold`() {
        val writer = RecordingStorageBatchWriter()
        val dlqProducer = RecordingDlqProducer()
        val metrics = StorageMetrics(SimpleMeterRegistry())
        val batchPersistWorker = BatchPersistWorker(
            flightBuffer = FlightBuffer(maxCapacity = 10_000),
            jdbcBatchWriter = writer,
            storageRetryPolicy = StorageRetryPolicy(listOf(0L)),
            storageDlqProducer = dlqProducer,
            storageMetrics = metrics,
            batchSize = 5000,
            flushIntervalMillis = 5000,
        )
        val worker = StorageConsumerWorker(
            objectMapper = jacksonObjectMapper(),
            batchPersistWorker = batchPersistWorker,
            storageMetrics = metrics,
            pauseThreshold = 10,
            resumeThreshold = 5,
        )

        val records = listOf(ConsumerRecord("live-adsb", 0, 1L, "ABC123", validPayload()))
        val acknowledgment = Mockito.mock(Acknowledgment::class.java)
        @Suppress("UNCHECKED_CAST")
        val consumer = Mockito.mock(Consumer::class.java) as Consumer<String, String>
        val assignment = setOf(TopicPartition("live-adsb", 0))
        Mockito.`when`(consumer.assignment()).thenReturn(assignment)
        Mockito.`when`(consumer.paused()).thenReturn(assignment)

        worker.consume(records, acknowledgment, consumer)

        Mockito.verify(consumer).resume(assignment)
        Mockito.verify(acknowledgment).acknowledge()
    }

    private fun validPayload(): String {
        return jacksonObjectMapper().writeValueAsString(
            EnrichedFlight(
                icao = "ABC123",
                lat = 21.0285,
                lon = 105.8542,
                eventTime = 1_700_000_000_000,
                sourceId = "radar-1",
                isHistorical = false,
            ),
        )
    }

    private class RecordingStorageBatchWriter : StorageBatchWriter {
        val writtenBatches: MutableList<List<PersistableFlight>> = mutableListOf()
        val quarantineBatches: MutableList<List<StorageFailedRecord>> = mutableListOf()

        override fun writeBatch(records: List<PersistableFlight>): Int {
            writtenBatches.add(records)
            return records.size
        }

        override fun writeQuarantine(records: List<StorageFailedRecord>): Int {
            quarantineBatches.add(records)
            return records.size
        }
    }

    private class RecordingDlqProducer : StorageDlqProducer {
        val published: MutableList<List<StorageFailedRecord>> = mutableListOf()

        override fun publish(records: List<StorageFailedRecord>) {
            published.add(records)
        }
    }
}
