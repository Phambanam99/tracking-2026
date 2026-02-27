package com.tracking.processing.engine

import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.CanonicalFlight
import com.tracking.common.dto.EnrichedFlight
import com.tracking.processing.dedup.DedupCacheConfig
import com.tracking.processing.dedup.DedupKeyService
import com.tracking.processing.enrich.FlightEnricher
import com.tracking.processing.enrich.IcaoCountryResolver
import com.tracking.processing.enrich.NoopAircraftPhotoProvider
import com.tracking.processing.enrich.ReferenceDataCache
import com.tracking.processing.enrich.ReferenceDataLoader
import com.tracking.processing.eventtime.EventTimeDecision
import com.tracking.processing.eventtime.EventTimeResolver
import com.tracking.processing.kafka.InvalidFlightRecord
import com.tracking.processing.kafka.InvalidRecordDlqProducer
import com.tracking.processing.kafka.ProcessingProducer
import com.tracking.processing.metrics.ProcessingMetrics
import com.tracking.processing.routing.TopicRouter
import com.tracking.processing.state.LastKnownStateStore
import com.tracking.processing.validation.KinematicValidator
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import java.time.Duration
import kotlin.test.Test

public class FlightStateFusionEngineIT {
    @Test
    public fun `should route older event to historical topic without overriding live state`() {
        val producer = RecordingProcessingProducer()
        val dlqProducer = RecordingDlqProducer()
        val engine = buildEngine(producer, dlqProducer)

        val latest = flight(eventTime = 10_000L, lat = 21.0, lon = 105.0)
        val historical = flight(eventTime = 9_000L, lat = 20.9, lon = 104.9)

        val firstResult = engine.process(latest)
        val secondResult = engine.process(historical)

        firstResult.status shouldBe ProcessingStatus.PUBLISHED
        firstResult.decision shouldBe EventTimeDecision.LIVE
        firstResult.outputTopic shouldBe TopicRouter.LIVE_TOPIC

        secondResult.status shouldBe ProcessingStatus.PUBLISHED
        secondResult.decision shouldBe EventTimeDecision.HISTORICAL
        secondResult.outputTopic shouldBe TopicRouter.HISTORICAL_TOPIC

        producer.published shouldHaveSize 2
        producer.published[0].topic shouldBe TopicRouter.LIVE_TOPIC
        producer.published[1].topic shouldBe TopicRouter.HISTORICAL_TOPIC
        dlqProducer.records shouldHaveSize 0
    }

    @Test
    public fun `should drop duplicate event within dedup ttl window`() {
        val producer = RecordingProcessingProducer()
        val dlqProducer = RecordingDlqProducer()
        val engine = buildEngine(producer, dlqProducer)
        val event = flight(eventTime = 10_000L)

        val first = engine.process(event)
        val second = engine.process(event)

        first.status shouldBe ProcessingStatus.PUBLISHED
        second.status shouldBe ProcessingStatus.DROPPED_DUPLICATE
        producer.published shouldHaveSize 1
        dlqProducer.records shouldHaveSize 0
    }

    @Test
    public fun `should publish invalid kinematic records to dlq`() {
        val producer = RecordingProcessingProducer()
        val dlqProducer = RecordingDlqProducer()
        val engine = buildEngine(producer, dlqProducer)
        val previous = flight(eventTime = 1_000L, lat = 21.0285, lon = 105.8542)
        val impossible = flight(eventTime = 11_000L, lat = 25.0285, lon = 109.8542)

        val first = engine.process(previous)
        val second = engine.process(impossible)

        first.status shouldBe ProcessingStatus.PUBLISHED
        second.status shouldBe ProcessingStatus.REJECTED_KINEMATIC

        producer.published shouldHaveSize 1
        dlqProducer.records shouldHaveSize 1
        dlqProducer.records.first().reason shouldBe "KINEMATIC_INVALID"
    }

    private fun buildEngine(
        producer: RecordingProcessingProducer,
        dlqProducer: RecordingDlqProducer,
    ): FlightStateFusionEngine {
        val referenceLoader =
            ReferenceDataLoader {
                mapOf(
                    "ABC123" to AircraftMetadata(registration = "VN-A001", operator = "TestAir"),
                )
            }
        return FlightStateFusionEngine(
            dedupKeyService = DedupKeyService(),
            dedupCacheConfig = DedupCacheConfig(ttl = Duration.ofSeconds(2), maxSize = 10_000),
            eventTimeResolver = EventTimeResolver(),
            lastKnownStateStore = LastKnownStateStore(maxSize = 10_000, ttl = Duration.ofHours(2)),
            kinematicValidator = KinematicValidator(maxSpeedKmh = 1200.0),
            flightEnricher =
                FlightEnricher(
                    ReferenceDataCache(referenceLoader, refreshInterval = Duration.ofMinutes(10)),
                    IcaoCountryResolver(imageUrlTemplate = "https://images/{icao}.jpg"),
                    NoopAircraftPhotoProvider,
                ),
            topicRouter = TopicRouter(),
            processingProducer = producer,
            invalidRecordDlqProducer = dlqProducer,
            processingMetrics = ProcessingMetrics(SimpleMeterRegistry()),
        )
    }

    private fun flight(
        eventTime: Long,
        lat: Double = 21.0285,
        lon: Double = 105.8542,
    ): CanonicalFlight =
        CanonicalFlight(
            icao = "ABC123",
            lat = lat,
            lon = lon,
            eventTime = eventTime,
            sourceId = "radar-1",
        )

    private class RecordingProcessingProducer : ProcessingProducer {
        val published: MutableList<PublishedMessage> = mutableListOf()

        override fun publish(topic: String, flight: EnrichedFlight) {
            published.add(PublishedMessage(topic, flight))
        }
    }

    private class RecordingDlqProducer : InvalidRecordDlqProducer {
        val records: MutableList<InvalidFlightRecord> = mutableListOf()

        override fun publish(record: InvalidFlightRecord) {
            records.add(record)
        }
    }

    private data class PublishedMessage(
        val topic: String,
        val flight: EnrichedFlight,
    )
}
