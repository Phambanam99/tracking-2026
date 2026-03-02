package com.tracking.processing.metrics

import com.tracking.processing.eventtime.EventTimeDecision
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import java.util.concurrent.TimeUnit
import org.springframework.stereotype.Component

@Component
public class ProcessingMetrics(
    meterRegistry: MeterRegistry,
) {
    private val rawConsumedCounter: Counter = meterRegistry.counter("tracking.processing.raw.consumed")
    private val malformedPayloadCounter: Counter = meterRegistry.counter("tracking.processing.raw.malformed")
    private val keyMismatchCounter: Counter = meterRegistry.counter("tracking.processing.raw.key_mismatch")
    private val droppedDuplicateCounter: Counter = meterRegistry.counter("tracking.processing.pipeline.dropped_duplicate")
    private val rejectedKinematicCounter: Counter = meterRegistry.counter("tracking.processing.pipeline.rejected_kinematic")
    private val publishedLiveCounter: Counter = meterRegistry.counter("tracking.processing.published.live")
    private val publishedHistoricalCounter: Counter = meterRegistry.counter("tracking.processing.published.historical")
    private val dlqPublishedCounter: Counter = meterRegistry.counter("tracking.processing.published.dlq")
    private val kafkaPublishFailedCounter: Counter = meterRegistry.counter("tracking.processing.kafka.publish_failed")
    private val dlqPublishFailedCounter: Counter = meterRegistry.counter("tracking.processing.kafka.dlq_publish_failed")

    private val pipelineLatencyTimer: Timer = meterRegistry.timer("tracking.processing.pipeline.latency")
    private val enrichmentLatencyTimer: Timer = meterRegistry.timer("tracking.processing.enrichment.latency")
    private val kafkaPublishLatencyTimer: Timer = meterRegistry.timer("tracking.processing.kafka.publish.latency")
    private val dlqPublishLatencyTimer: Timer = meterRegistry.timer("tracking.processing.kafka.dlq_publish.latency")

    public fun incrementRawConsumed(): Unit = rawConsumedCounter.increment()

    public fun incrementMalformedPayload(): Unit = malformedPayloadCounter.increment()

    public fun incrementKeyMismatch(): Unit = keyMismatchCounter.increment()

    public fun incrementDroppedDuplicate(): Unit = droppedDuplicateCounter.increment()

    public fun incrementRejectedKinematic(): Unit = rejectedKinematicCounter.increment()

    public fun incrementPublished(decision: EventTimeDecision): Unit =
        when (decision) {
            EventTimeDecision.LIVE -> publishedLiveCounter.increment()
            EventTimeDecision.HISTORICAL -> publishedHistoricalCounter.increment()
        }

    public fun incrementDlqPublished(): Unit = dlqPublishedCounter.increment()

    public fun incrementKafkaPublishFailed(): Unit = kafkaPublishFailedCounter.increment()

    public fun incrementDlqPublishFailed(): Unit = dlqPublishFailedCounter.increment()

    public fun recordPipelineLatencyNanos(nanos: Long): Unit =
        pipelineLatencyTimer.record(nanos.coerceAtLeast(0L), TimeUnit.NANOSECONDS)

    public fun recordEnrichmentLatencyNanos(nanos: Long): Unit =
        enrichmentLatencyTimer.record(nanos.coerceAtLeast(0L), TimeUnit.NANOSECONDS)

    public fun recordKafkaPublishLatencyNanos(nanos: Long): Unit =
        kafkaPublishLatencyTimer.record(nanos.coerceAtLeast(0L), TimeUnit.NANOSECONDS)

    public fun recordDlqPublishLatencyNanos(nanos: Long): Unit =
        dlqPublishLatencyTimer.record(nanos.coerceAtLeast(0L), TimeUnit.NANOSECONDS)
}
