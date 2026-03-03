package com.tracking.processing.engine

import com.tracking.common.dto.CanonicalShip
import com.tracking.common.dto.EnrichedShip
import com.tracking.processing.dedup.DedupCacheConfig
import com.tracking.processing.dedup.ShipDedupKeyService
import com.tracking.processing.enrich.ShipEnricher
import com.tracking.processing.eventtime.EventTimeDecision
import com.tracking.processing.eventtime.EventTimeResolver
import com.tracking.processing.kafka.InvalidShipRecord
import com.tracking.processing.kafka.ShipInvalidRecordDlqProducer
import com.tracking.processing.kafka.ShipProcessingProducer
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.routing.ShipTopicRouter
import com.tracking.processing.state.ShipLastKnownStateStore
import com.tracking.processing.validation.ShipKinematicValidator

public interface ShipProcessor {
    public fun process(ship: CanonicalShip): ShipProcessingResult
}

public class ShipStateFusionEngine(
    private val dedupKeyService: ShipDedupKeyService,
    private val dedupCacheConfig: DedupCacheConfig,
    private val eventTimeResolver: EventTimeResolver,
    private val lastKnownStateStore: ShipLastKnownStateStore,
    private val kinematicValidator: ShipKinematicValidator,
    private val shipEnricher: ShipEnricher,
    private val topicRouter: ShipTopicRouter,
    private val processingProducer: ShipProcessingProducer,
    private val invalidRecordDlqProducer: ShipInvalidRecordDlqProducer,
    private val processingMetrics: ProcessingMetrics,
) : ShipProcessor {
    override fun process(ship: CanonicalShip): ShipProcessingResult {
        val startedAtNanos = System.nanoTime()
        return try {
            val dedupKey = dedupKeyService.keyFor(ship)
            val isDuplicate = dedupCacheConfig.isDuplicateAndRemember(dedupKey)
            if (isDuplicate) {
                processingMetrics.incrementDroppedDuplicate()
                return ShipProcessingResult(status = ShipProcessingStatus.DROPPED_DUPLICATE)
            }

            val previous = lastKnownStateStore.get(ship.mmsi)
            val decision = eventTimeResolver.resolve(previous?.eventTime, ship.eventTime)

            if (decision == EventTimeDecision.LIVE && previous != null) {
                val validation = kinematicValidator.validate(previous, ship)
                if (!validation.isValid) {
                    processingMetrics.incrementRejectedKinematic()
                    invalidRecordDlqProducer.publish(
                        InvalidShipRecord(
                            reason = KINEMATIC_INVALID_REASON,
                            ship = ship,
                            previousShip = previous,
                            computedSpeedKmh = validation.computedSpeedKmh,
                        ),
                    )
                    return ShipProcessingResult(
                        status = ShipProcessingStatus.REJECTED_KINEMATIC,
                        decision = decision,
                    )
                }
            }

            val enrichStartedAtNanos = System.nanoTime()
            val enriched = shipEnricher.enrich(ship, isHistorical = decision == EventTimeDecision.HISTORICAL)
            processingMetrics.recordEnrichmentLatencyNanos(System.nanoTime() - enrichStartedAtNanos)

            val outputTopic = topicRouter.route(decision)
            processingProducer.publish(outputTopic, enriched)
            processingMetrics.incrementPublished(decision)
            if (decision == EventTimeDecision.LIVE) {
                lastKnownStateStore.put(ship)
            }

            ShipProcessingResult(
                status = ShipProcessingStatus.PUBLISHED,
                outputTopic = outputTopic,
                decision = decision,
                enrichedShip = enriched,
            )
        } finally {
            processingMetrics.recordPipelineLatencyNanos(System.nanoTime() - startedAtNanos)
        }
    }

    private companion object {
        private const val KINEMATIC_INVALID_REASON: String = "KINEMATIC_INVALID"
    }
}

public data class ShipProcessingResult(
    val status: ShipProcessingStatus,
    val outputTopic: String? = null,
    val decision: EventTimeDecision? = null,
    val enrichedShip: EnrichedShip? = null,
)

public enum class ShipProcessingStatus {
    PUBLISHED,
    DROPPED_DUPLICATE,
    REJECTED_KINEMATIC,
}
