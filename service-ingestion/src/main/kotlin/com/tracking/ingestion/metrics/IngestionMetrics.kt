package com.tracking.ingestion.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component

@Component
public class IngestionMetrics(
    meterRegistry: MeterRegistry,
) {
    private val acceptedSingleCounter: Counter = meterRegistry.counter("tracking.ingestion.accepted.single")
    private val acceptedBatchRecordsCounter: Counter = meterRegistry.counter("tracking.ingestion.accepted.batch.records")
    private val publishedCounter: Counter = meterRegistry.counter("tracking.ingestion.kafka.published")
    private val validationRejectedCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.validation")
    private val authRejectedCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.auth")
    private val admissionRejectedCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.admission")
    private val producerUnavailableCounter: Counter = meterRegistry.counter("tracking.ingestion.rejected.producer_unavailable")
    private val revocationAppliedCounter: Counter = meterRegistry.counter("tracking.ingestion.revocation.applied")

    public fun incrementAcceptedSingle(): Unit = acceptedSingleCounter.increment()

    public fun incrementAcceptedBatch(records: Int): Unit = acceptedBatchRecordsCounter.increment(records.toDouble())

    public fun incrementPublished(records: Int): Unit = publishedCounter.increment(records.toDouble())

    public fun incrementValidationRejected(): Unit = validationRejectedCounter.increment()

    public fun incrementAuthRejected(): Unit = authRejectedCounter.increment()

    public fun incrementAdmissionRejected(): Unit = admissionRejectedCounter.increment()

    public fun incrementProducerUnavailable(): Unit = producerUnavailableCounter.increment()

    public fun incrementRevocationApplied(): Unit = revocationAppliedCounter.increment()
}
