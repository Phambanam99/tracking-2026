package com.tracking.storage.worker

import com.tracking.common.dto.EnrichedFlight
import com.tracking.storage.buffer.FlightBuffer
import com.tracking.storage.db.StorageBatchWriter
import com.tracking.storage.kafka.StorageDlqProducer
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.PersistableFlight
import com.tracking.storage.model.PersistableShip
import com.tracking.storage.model.StorageFailedRecord
import com.tracking.storage.retry.StorageRetryPolicy
import com.tracking.storage.tracing.StorageTraceContext
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

public class BatchPersistWorkerTest {
    @Test
    public fun `should write batch successfully and avoid dlq`() {
        val writer = RecordingStorageBatchWriter(writeFailure = null)
        val dlqProducer = RecordingDlqProducer()
        val worker = buildWorker(writer, dlqProducer)

        worker.persistAndFlush(listOf(flight("ABC123"), flight("ABC124")))

        writer.writtenBatches shouldHaveSize 1
        writer.quarantineBatches shouldHaveSize 0
        dlqProducer.published shouldHaveSize 0
    }

    @Test
    public fun `should route failed batch to quarantine and dlq after retries`() {
        val writer = RecordingStorageBatchWriter(writeFailure = IllegalStateException("db unavailable"))
        val dlqProducer = RecordingDlqProducer()
        val worker = buildWorker(writer, dlqProducer)

        worker.persistAndFlush(listOf(flight("ABC123"), flight("ABC124")))

        writer.writtenBatches shouldHaveSize 3
        writer.quarantineBatches shouldHaveSize 1
        dlqProducer.published shouldHaveSize 1
        dlqProducer.published.first().first().reason shouldBe "DB_WRITE_FAILED"
    }

    @Test
    public fun `should throw when both quarantine and dlq fail after write failure`() {
        val writer = RecordingStorageBatchWriter(
            writeFailure = IllegalStateException("db unavailable"),
            quarantineFailure = IllegalStateException("quarantine unavailable"),
        )
        val dlqProducer = RecordingDlqProducer(failure = IllegalStateException("dlq unavailable"))
        val worker = buildWorker(writer, dlqProducer)

        assertThrows(IllegalStateException::class.java) {
            worker.persistAndFlush(listOf(flight("ABC123")))
        }
    }

    private fun buildWorker(
        writer: RecordingStorageBatchWriter,
        dlqProducer: RecordingDlqProducer,
    ): BatchPersistWorker {
        return BatchPersistWorker(
            flightBuffer = FlightBuffer(maxCapacity = 10_000),
            jdbcBatchWriter = writer,
            storageRetryPolicy = StorageRetryPolicy(listOf(0L, 0L, 0L)) { },
            storageDlqProducer = dlqProducer,
            storageMetrics = StorageMetrics(SimpleMeterRegistry()),
            batchSize = 5000,
            flushIntervalMillis = 5000,
        )
    }

    private fun flight(icao: String): PersistableFlight {
        return PersistableFlight(
            flight = EnrichedFlight(
                icao = icao,
                lat = 21.0285,
                lon = 105.8542,
                eventTime = 1_700_000_000_000,
                sourceId = "radar-1",
                isHistorical = false,
            ),
            sourceTopic = "live-adsb",
            rawPayload = """{"icao":"$icao"}""",
            traceContext = StorageTraceContext(requestId = "req-$icao"),
        )
    }

    private class RecordingStorageBatchWriter(
        private val writeFailure: Throwable?,
        private val quarantineFailure: Throwable? = null,
    ) : StorageBatchWriter {
        val writtenBatches: MutableList<List<PersistableFlight>> = mutableListOf()
        val quarantineBatches: MutableList<List<StorageFailedRecord>> = mutableListOf()

        override fun writeBatch(records: List<PersistableFlight>): Int {
            writtenBatches.add(records)
            if (writeFailure != null) {
                throw writeFailure
            }
            return records.size
        }

        override fun writeShipBatch(records: List<PersistableShip>): Int = records.size

        override fun writeQuarantine(records: List<StorageFailedRecord>): Int {
            quarantineBatches.add(records)
            if (quarantineFailure != null) {
                throw quarantineFailure
            }
            return records.size
        }
    }

    private class RecordingDlqProducer(
        private val failure: Throwable? = null,
    ) : StorageDlqProducer {
        val published: MutableList<List<StorageFailedRecord>> = mutableListOf()

        override fun publish(records: List<StorageFailedRecord>) {
            published.add(records)
            if (failure != null) {
                throw failure
            }
        }
    }
}
