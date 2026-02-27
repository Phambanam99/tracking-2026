package com.tracking.storage.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.springframework.stereotype.Component

@Component
public class StorageMetrics(
    meterRegistry: MeterRegistry,
) {
    private val batchWrittenCounter: Counter = meterRegistry.counter("tracking.storage.batch.written")
    private val batchFailedCounter: Counter = meterRegistry.counter("tracking.storage.batch.failed")
    private val rowsWrittenCounter: Counter = meterRegistry.counter("tracking.storage.rows.written")
    private val dlqPublishedCounter: Counter = meterRegistry.counter("tracking.storage.dlq.published")
    private val malformedPayloadCounter: Counter = meterRegistry.counter("tracking.storage.records.malformed")
    private val batchLatencyTimer: Timer = meterRegistry.timer("tracking.storage.batch.latency")
    private val bufferSizeValue: AtomicInteger = AtomicInteger(0)

    init {
        Gauge.builder("tracking.storage.buffer.size") { bufferSizeValue.get().toDouble() }
            .register(meterRegistry)
    }

    public fun incrementBatchWritten(): Unit = batchWrittenCounter.increment()

    public fun incrementBatchFailed(): Unit = batchFailedCounter.increment()

    public fun incrementRowsWritten(rows: Long): Unit = rowsWrittenCounter.increment(rows.toDouble().coerceAtLeast(0.0))

    public fun incrementDlqPublished(): Unit = dlqPublishedCounter.increment()

    public fun incrementMalformedPayload(): Unit = malformedPayloadCounter.increment()

    public fun recordBatchLatencyNanos(nanos: Long): Unit =
        batchLatencyTimer.record(nanos.coerceAtLeast(0L), TimeUnit.NANOSECONDS)

    public fun setBufferSize(size: Int): Unit = bufferSizeValue.set(size.coerceAtLeast(0))
}
