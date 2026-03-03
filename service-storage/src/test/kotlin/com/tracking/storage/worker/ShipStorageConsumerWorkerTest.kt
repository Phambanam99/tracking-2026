package com.tracking.storage.worker

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.common.dto.EnrichedShip
import com.tracking.storage.buffer.ShipBuffer
import com.tracking.storage.db.StorageBatchWriter
import com.tracking.storage.kafka.StorageDlqProducer
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.PersistableFlight
import com.tracking.storage.model.PersistableShip
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

public class ShipStorageConsumerWorkerTest {
    @Test
    public fun `should persist valid ship records and quarantine malformed payloads then acknowledge`() {
        val writer = RecordingStorageBatchWriter()
        val dlqProducer = RecordingDlqProducer()
        val metrics = StorageMetrics(SimpleMeterRegistry())
        val batchPersistWorker = ShipBatchPersistWorker(
            shipBuffer = ShipBuffer(maxCapacity = 10_000),
            jdbcBatchWriter = writer,
            storageRetryPolicy = StorageRetryPolicy(listOf(0L)),
            storageDlqProducer = dlqProducer,
            storageMetrics = metrics,
            batchSize = 5000,
            flushIntervalMillis = 5000,
        )
        val worker = ShipStorageConsumerWorker(
            objectMapper = jacksonObjectMapper(),
            shipBatchPersistWorker = batchPersistWorker,
            storageMetrics = metrics,
            pauseThreshold = 10,
            resumeThreshold = 5,
        )

        val records = listOf(
            ConsumerRecord("live-ais", 0, 1L, "574001230", validPayload()),
            ConsumerRecord("live-ais", 0, 2L, "574009999", "{not-json"),
        )
        val acknowledgment = Mockito.mock(Acknowledgment::class.java)
        @Suppress("UNCHECKED_CAST")
        val consumer = Mockito.mock(Consumer::class.java) as Consumer<String, String>
        val assignment = setOf(TopicPartition("live-ais", 0))
        Mockito.`when`(consumer.assignment()).thenReturn(assignment)
        Mockito.`when`(consumer.paused()).thenReturn(emptySet())

        worker.consume(records, acknowledgment, consumer)

        writer.writtenShipBatches shouldHaveSize 1
        writer.writtenShipBatches.first() shouldHaveSize 1
        writer.quarantineBatches shouldHaveSize 1
        writer.quarantineBatches.first() shouldHaveSize 1
        dlqProducer.published shouldHaveSize 1
        dlqProducer.published.first() shouldHaveSize 1
        Mockito.verify(acknowledgment).acknowledge()
    }

    @Test
    public fun `should resume ship consumer when it is paused and buffer is below resume threshold`() {
        val writer = RecordingStorageBatchWriter()
        val dlqProducer = RecordingDlqProducer()
        val metrics = StorageMetrics(SimpleMeterRegistry())
        val batchPersistWorker = ShipBatchPersistWorker(
            shipBuffer = ShipBuffer(maxCapacity = 10_000),
            jdbcBatchWriter = writer,
            storageRetryPolicy = StorageRetryPolicy(listOf(0L)),
            storageDlqProducer = dlqProducer,
            storageMetrics = metrics,
            batchSize = 5000,
            flushIntervalMillis = 5000,
        )
        val worker = ShipStorageConsumerWorker(
            objectMapper = jacksonObjectMapper(),
            shipBatchPersistWorker = batchPersistWorker,
            storageMetrics = metrics,
            pauseThreshold = 10,
            resumeThreshold = 5,
        )

        val records = listOf(ConsumerRecord("live-ais", 0, 1L, "574001230", validPayload()))
        val acknowledgment = Mockito.mock(Acknowledgment::class.java)
        @Suppress("UNCHECKED_CAST")
        val consumer = Mockito.mock(Consumer::class.java) as Consumer<String, String>
        val assignment = setOf(TopicPartition("live-ais", 0))
        Mockito.`when`(consumer.assignment()).thenReturn(assignment)
        Mockito.`when`(consumer.paused()).thenReturn(assignment)

        worker.consume(records, acknowledgment, consumer)

        Mockito.verify(consumer).resume(assignment)
        Mockito.verify(acknowledgment).acknowledge()
    }

    private fun validPayload(): String {
        return jacksonObjectMapper().writeValueAsString(
            EnrichedShip(
                mmsi = "574001230",
                lat = 21.0285,
                lon = 105.8542,
                vesselName = "PACIFIC TRADER",
                vesselType = "cargo",
                eventTime = 1_700_000_000_000,
                sourceId = "ais-1",
                isHistorical = false,
            ),
        )
    }

    private class RecordingStorageBatchWriter : StorageBatchWriter {
        val writtenShipBatches: MutableList<List<PersistableShip>> = mutableListOf()
        val quarantineBatches: MutableList<List<StorageFailedRecord>> = mutableListOf()

        override fun writeBatch(records: List<PersistableFlight>): Int = records.size

        override fun writeShipBatch(records: List<PersistableShip>): Int {
            writtenShipBatches.add(records)
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
