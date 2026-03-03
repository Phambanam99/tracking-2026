package com.tracking.storage.worker

import com.tracking.storage.buffer.ShipBuffer
import com.tracking.storage.db.StorageBatchWriter
import com.tracking.storage.kafka.StorageDlqProducer
import com.tracking.storage.metrics.StorageMetrics
import com.tracking.storage.model.PersistableShip
import com.tracking.storage.model.StorageFailedRecord
import com.tracking.storage.retry.StorageRetryPolicy
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
public class ShipBatchPersistWorker(
    private val shipBuffer: ShipBuffer,
    private val jdbcBatchWriter: StorageBatchWriter,
    private val storageRetryPolicy: StorageRetryPolicy,
    private val storageDlqProducer: StorageDlqProducer,
    private val storageMetrics: StorageMetrics,
    @Value("\${tracking.storage.batch.max-size:5000}")
    private val batchSize: Int = 5000,
    @Value("\${tracking.storage.batch.flush-interval-millis:5000}")
    private val flushIntervalMillis: Long = 5000,
) {
    @Volatile
    private var lastFlushAtMillis: Long = System.currentTimeMillis()

    @Synchronized
    public fun persistAndFlush(records: List<PersistableShip>): Unit {
        if (records.isEmpty()) {
            return
        }

        shipBuffer.offerAll(records)
        storageMetrics.setBufferSize(shipBuffer.size())
        flush(force = true)
    }

    public fun currentBufferSize(): Int = shipBuffer.size()

    @Synchronized
    public fun flushOnPartitionsRevoked(): Unit {
        flush(force = true)
    }

    public fun handleFailedRecords(records: List<StorageFailedRecord>): Unit {
        if (records.isEmpty()) {
            return
        }

        jdbcBatchWriter.writeQuarantine(records)
        storageDlqProducer.publish(records)
    }

    private fun flush(force: Boolean): Unit {
        while (shouldFlush(force)) {
            val batch = shipBuffer.drainUpTo(resolveDrainSize(force))
            if (batch.isEmpty()) {
                break
            }
            processBatch(batch)
        }
        storageMetrics.setBufferSize(shipBuffer.size())
    }

    private fun shouldFlush(force: Boolean): Boolean {
        if (shipBuffer.isEmpty()) {
            return false
        }
        if (shipBuffer.size() >= batchSize) {
            return true
        }
        if (force) {
            return true
        }
        return System.currentTimeMillis() - lastFlushAtMillis >= flushIntervalMillis
    }

    private fun resolveDrainSize(force: Boolean): Int {
        return if (force) {
            batchSize.coerceAtMost(shipBuffer.size()).coerceAtLeast(1)
        } else {
            batchSize
        }
    }

    private fun processBatch(batch: List<PersistableShip>): Unit {
        val startedAtNanos = System.nanoTime()
        try {
            val writtenRows = storageRetryPolicy.execute { jdbcBatchWriter.writeShipBatch(batch) }
            storageMetrics.incrementBatchWritten()
            storageMetrics.incrementRowsWritten(writtenRows.toLong())
        } catch (error: Throwable) {
            storageMetrics.incrementBatchFailed()
            val failedRecords = batch.map { persistable ->
                StorageFailedRecord(
                    reason = REASON_DB_WRITE_FAILED,
                    sourceTopic = persistable.sourceTopic,
                    payload = persistable.rawPayload,
                    recordKey = persistable.ship.mmsi,
                    traceContext = persistable.traceContext,
                    errorMessage = error.message,
                )
            }
            val quarantineResult = runCatching { jdbcBatchWriter.writeQuarantine(failedRecords) }
            val dlqResult = runCatching { storageDlqProducer.publish(failedRecords) }

            if (quarantineResult.isFailure && dlqResult.isFailure) {
                throw IllegalStateException(
                    "Both quarantine write and DLQ publish failed for ship storage batch.",
                    error,
                )
            }
        } finally {
            lastFlushAtMillis = System.currentTimeMillis()
            storageMetrics.recordBatchLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }

    private companion object {
        private const val REASON_DB_WRITE_FAILED: String = "DB_WRITE_FAILED"
    }
}
