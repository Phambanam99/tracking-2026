package com.tracking.processing.engine

import com.tracking.common.dto.CanonicalFlight
import com.tracking.common.dto.EnrichedFlight
import com.tracking.processing.dedup.DedupCacheConfig
import com.tracking.processing.dedup.DedupKeyService
import com.tracking.processing.enrich.FlightEnricher
import com.tracking.processing.eventtime.EventTimeDecision
import com.tracking.processing.eventtime.EventTimeResolver
import com.tracking.processing.kafka.InvalidFlightRecord
import com.tracking.processing.kafka.InvalidRecordDlqProducer
import com.tracking.processing.kafka.ProcessingProducer
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.routing.TopicRouter
import com.tracking.processing.state.LastKnownStateStore
import com.tracking.processing.validation.KinematicValidator

public interface FlightProcessor {
    public fun process(flight: CanonicalFlight): ProcessingResult
}

public class FlightStateFusionEngine(
    private val dedupKeyService: DedupKeyService,
    private val dedupCacheConfig: DedupCacheConfig,
    private val eventTimeResolver: EventTimeResolver,
    private val lastKnownStateStore: LastKnownStateStore,
    private val kinematicValidator: KinematicValidator,
    private val flightEnricher: FlightEnricher,
    private val topicRouter: TopicRouter,
    private val processingProducer: ProcessingProducer,
    private val invalidRecordDlqProducer: InvalidRecordDlqProducer,
    private val processingMetrics: ProcessingMetrics,
) : FlightProcessor {
    override fun process(flight: CanonicalFlight): ProcessingResult {
        val startedAtNanos = System.nanoTime()
        return try {
            val dedupKey = dedupKeyService.keyFor(flight)
            val isDuplicate = dedupCacheConfig.isDuplicateAndRemember(dedupKey)
            if (isDuplicate) {
                processingMetrics.incrementDroppedDuplicate()
                return ProcessingResult(status = ProcessingStatus.DROPPED_DUPLICATE)
            }

            val previous = lastKnownStateStore.get(flight.icao)
            val decision = eventTimeResolver.resolve(previous?.eventTime, flight.eventTime)

            if (decision == EventTimeDecision.LIVE && previous != null) {
                val validation = kinematicValidator.validate(previous, flight)
                if (!validation.isValid) {
                    processingMetrics.incrementRejectedKinematic()
                    invalidRecordDlqProducer.publish(
                        InvalidFlightRecord(
                            reason = KINEMATIC_INVALID_REASON,
                            flight = flight,
                            previousFlight = previous,
                            computedSpeedKmh = validation.computedSpeedKmh,
                        ),
                    )
                    return ProcessingResult(
                        status = ProcessingStatus.REJECTED_KINEMATIC,
                        decision = decision,
                    )
                }
            }

            val enrichStartedAtNanos = System.nanoTime()
            val enriched = flightEnricher.enrich(flight, isHistorical = decision == EventTimeDecision.HISTORICAL)
            processingMetrics.recordEnrichmentLatencyNanos(System.nanoTime() - enrichStartedAtNanos)

            val outputTopic = topicRouter.route(decision)
            processingProducer.publish(outputTopic, enriched)
            processingMetrics.incrementPublished(decision)
            if (decision == EventTimeDecision.LIVE) {
                lastKnownStateStore.put(flight)
            }

            ProcessingResult(
                status = ProcessingStatus.PUBLISHED,
                outputTopic = outputTopic,
                decision = decision,
                enrichedFlight = enriched,
            )
        } finally {
            processingMetrics.recordPipelineLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }

    private companion object {
        private const val KINEMATIC_INVALID_REASON: String = "KINEMATIC_INVALID"
    }
}

public data class ProcessingResult(
    val status: ProcessingStatus,
    val outputTopic: String? = null,
    val decision: EventTimeDecision? = null,
    val enrichedFlight: EnrichedFlight? = null,
)

public enum class ProcessingStatus {
    PUBLISHED,
    DROPPED_DUPLICATE,
    REJECTED_KINEMATIC,
}
