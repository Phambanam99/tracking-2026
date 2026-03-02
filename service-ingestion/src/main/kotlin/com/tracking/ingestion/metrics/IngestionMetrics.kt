package com.tracking.ingestion.metrics

import com.tracking.common.dto.CanonicalFlight
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import java.util.concurrent.ConcurrentHashMap
import org.springframework.stereotype.Component

@Component
public class IngestionMetrics(
    private val meterRegistry: MeterRegistry,
) {
    private val acceptedSingleCounter: Counter = meterRegistry.counter("tracking.ingestion.accepted.single")
    private val acceptedBatchRecordsCounter: Counter = meterRegistry.counter("tracking.ingestion.accepted.batch.records")
    private val publishedCounter: Counter = meterRegistry.counter("tracking.ingestion.kafka.published")
    private val validationRejectedCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.validation")
    private val authRejectedCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.auth")
    private val admissionRejectedCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.admission")
    private val producerUnavailableCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.producer_unavailable")
    private val kafkaPublishFailedCounter: Counter = meterRegistry.counter("tracking.ingestion.kafka.publish_failed")
    private val revocationAppliedCounter: Counter = meterRegistry.counter("tracking.ingestion.revocation.applied")
    private val acceptedBySourceCounters: MutableMap<String, Counter> = ConcurrentHashMap()
    private val publishedBySourceCounters: MutableMap<String, Counter> = ConcurrentHashMap()

    public fun incrementAcceptedSingle(sourceId: String): Unit {
        acceptedSingleCounter.increment()
        acceptedCounterFor(sourceId).increment()
    }

    public fun incrementAcceptedBatch(flights: List<CanonicalFlight>): Unit {
        acceptedBatchRecordsCounter.increment(flights.size.toDouble())
        flights.groupingBy { normalizeSourceId(it.sourceId) }.eachCount().forEach { (sourceId, count) ->
            acceptedCounterFor(sourceId).increment(count.toDouble())
        }
    }

    public fun incrementPublished(sourceId: String): Unit {
        publishedCounter.increment()
        publishedCounterFor(sourceId).increment()
    }

    public fun incrementValidationRejected(): Unit = validationRejectedCounter.increment()

    public fun incrementAuthRejected(): Unit = authRejectedCounter.increment()

    public fun incrementAdmissionRejected(): Unit = admissionRejectedCounter.increment()

    public fun incrementProducerUnavailable(): Unit = producerUnavailableCounter.increment()

    public fun incrementKafkaPublishFailed(): Unit = kafkaPublishFailedCounter.increment()

    public fun incrementRevocationApplied(): Unit = revocationAppliedCounter.increment()

    private fun acceptedCounterFor(sourceId: String): Counter =
        acceptedBySourceCounters.computeIfAbsent(normalizeSourceId(sourceId)) { normalizedSourceId ->
            meterRegistry.counter("tracking.ingestion.accepted.records", "source_id", normalizedSourceId)
        }

    private fun publishedCounterFor(sourceId: String): Counter =
        publishedBySourceCounters.computeIfAbsent(normalizeSourceId(sourceId)) { normalizedSourceId ->
            meterRegistry.counter("tracking.ingestion.kafka.published.records", "source_id", normalizedSourceId)
        }

    private fun normalizeSourceId(sourceId: String): String =
        sourceId.trim().ifBlank { "UNKNOWN" }
}
