package com.tracking.processing.engine

import com.tracking.common.dto.CanonicalShip
import com.tracking.common.dto.EnrichedShip
import com.tracking.common.dto.ShipMetadata
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
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.time.Duration
import kotlin.test.Test

public class ShipStateFusionEngineIT {
    @Test
    public fun `should route older ship event to historical topic without overriding live state`() {
        val producer = RecordingShipProcessingProducer()
        val dlqProducer = RecordingShipDlqProducer()
        val engine = buildEngine(producer, dlqProducer)

        val latest = ship(eventTime = 10_000L, lat = 10.80, lon = 106.80)
        val historical = ship(eventTime = 9_000L, lat = 10.79, lon = 106.79)

        val firstResult = engine.process(latest)
        val secondResult = engine.process(historical)

        firstResult.status shouldBe ShipProcessingStatus.PUBLISHED
        firstResult.decision shouldBe EventTimeDecision.LIVE
        firstResult.outputTopic shouldBe ShipTopicRouter.LIVE_TOPIC

        secondResult.status shouldBe ShipProcessingStatus.PUBLISHED
        secondResult.decision shouldBe EventTimeDecision.HISTORICAL
        secondResult.outputTopic shouldBe ShipTopicRouter.HISTORICAL_TOPIC

        producer.published shouldHaveSize 2
        producer.published[0].topic shouldBe ShipTopicRouter.LIVE_TOPIC
        producer.published[1].topic shouldBe ShipTopicRouter.HISTORICAL_TOPIC
        dlqProducer.records shouldHaveSize 0
    }

    @Test
    public fun `should drop duplicate ship event within dedup ttl window`() {
        val producer = RecordingShipProcessingProducer()
        val dlqProducer = RecordingShipDlqProducer()
        val engine = buildEngine(producer, dlqProducer)
        val event = ship(eventTime = 10_000L)

        val first = engine.process(event)
        val second = engine.process(event)

        first.status shouldBe ShipProcessingStatus.PUBLISHED
        second.status shouldBe ShipProcessingStatus.DROPPED_DUPLICATE
        producer.published shouldHaveSize 1
        dlqProducer.records shouldHaveSize 0
    }

    @Test
    public fun `should publish invalid ship kinematic records to dlq`() {
        val producer = RecordingShipProcessingProducer()
        val dlqProducer = RecordingShipDlqProducer()
        val engine = buildEngine(producer, dlqProducer)
        val previous = ship(eventTime = 1_000L, lat = 10.7769, lon = 106.7009)
        val impossible = ship(eventTime = 11_000L, lat = 13.7769, lon = 109.7009)

        val first = engine.process(previous)
        val second = engine.process(impossible)

        first.status shouldBe ShipProcessingStatus.PUBLISHED
        second.status shouldBe ShipProcessingStatus.REJECTED_KINEMATIC

        producer.published shouldHaveSize 1
        dlqProducer.records shouldHaveSize 1
        dlqProducer.records.first().reason shouldBe "KINEMATIC_INVALID"
    }

    @Test
    public fun `should keep vessel name from higher priority source signalr over chinaport and aisstream`() {
        val producer = RecordingShipProcessingProducer()
        val dlqProducer = RecordingShipDlqProducer()
        val engine = buildEngine(producer, dlqProducer)

        val signalr = ship(
            eventTime = 10_000L,
            vesselName = "SIGNALR NAME",
            sourceId = "AIS-SIGNALR",
        )
        val chinaport = ship(
            eventTime = 11_000L,
            vesselName = "CHINAPORT NAME",
            sourceId = "CHINAPORT-AIS",
        )
        val aisstream = ship(
            eventTime = 12_000L,
            vesselName = "AISSTREAM NAME",
            sourceId = "AISSTREAM-IO",
        )

        engine.process(signalr)
        val chinaportResult = engine.process(chinaport)
        val aisstreamResult = engine.process(aisstream)

        chinaportResult.enrichedShip?.vesselName shouldBe "SIGNALR NAME"
        aisstreamResult.enrichedShip?.vesselName shouldBe "SIGNALR NAME"
        dlqProducer.records shouldHaveSize 0
    }

    private fun buildEngine(
        producer: RecordingShipProcessingProducer,
        dlqProducer: RecordingShipDlqProducer,
    ): ShipStateFusionEngine {
        return ShipStateFusionEngine(
            dedupKeyService = ShipDedupKeyService(),
            dedupCacheConfig = DedupCacheConfig(ttl = Duration.ofSeconds(2), maxSize = 10_000),
            eventTimeResolver = EventTimeResolver(),
            lastKnownStateStore = ShipLastKnownStateStore(maxSize = 10_000, ttl = Duration.ofHours(2)),
            kinematicValidator = ShipKinematicValidator(maxSpeedKmh = 120.0),
            shipEnricher = ShipEnricher(),
            topicRouter = ShipTopicRouter(),
            processingProducer = producer,
            invalidRecordDlqProducer = dlqProducer,
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
        )
    }

    private fun ship(
        eventTime: Long,
        lat: Double = 10.7769,
        lon: Double = 106.7009,
        vesselName: String? = null,
        sourceId: String = "ais-1",
    ): CanonicalShip =
        CanonicalShip(
            mmsi = "574001230",
            lat = lat,
            lon = lon,
            vesselName = vesselName,
            vesselType = "cargo",
            eventTime = eventTime,
            sourceId = sourceId,
        )

    private class RecordingShipProcessingProducer : ShipProcessingProducer {
        val published: MutableList<PublishedShipMessage> = mutableListOf()

        override fun publish(topic: String, ship: EnrichedShip) {
            published.add(PublishedShipMessage(topic, ship))
        }
    }

    private class RecordingShipDlqProducer : ShipInvalidRecordDlqProducer {
        val records: MutableList<InvalidShipRecord> = mutableListOf()

        override fun publish(record: InvalidShipRecord) {
            records.add(record)
        }
    }

    private data class PublishedShipMessage(
        val topic: String,
        val ship: EnrichedShip,
    )
}
