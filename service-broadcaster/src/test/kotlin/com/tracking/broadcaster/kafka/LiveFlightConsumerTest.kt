package com.tracking.broadcaster.kafka

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.broadcaster.spatial.BoundingBoxMatcher
import com.tracking.broadcaster.spatial.SpatialPushEngine
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.broadcaster.ws.SessionFlightPusher
import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedFlight
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlin.test.Test
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener

public class LiveFlightConsumerTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    public fun `should push matching flight for valid payload`() {
        val registry = ViewportRegistry()
        registry.register("session-1", "alice", BoundingBox(22.0, 20.0, 106.0, 105.0))
        val pushed: MutableList<Pair<ViewportSession, EnrichedFlight>> = mutableListOf()
        val consumer = LiveFlightConsumer(
            objectMapper = objectMapper,
            spatialPushEngine = SpatialPushEngine(
                viewportRegistry = registry,
                boundingBoxMatcher = BoundingBoxMatcher(),
                sessionFlightPusher = SessionFlightPusher { session, flight ->
                    pushed.add(session to flight)
                    true
                },
            ),
        )
        val payload = objectMapper.writeValueAsString(flight(lat = 21.0, lon = 105.5))

        consumer.consume(ConsumerRecord("live-adsb", 0, 0L, "ICAO123", payload))

        pushed shouldHaveSize 1
        pushed.first().first.sessionId shouldBe "session-1"
    }

    @Test
    public fun `should skip malformed payload`() {
        val registry = ViewportRegistry()
        registry.register("session-1", "alice", BoundingBox(22.0, 20.0, 106.0, 105.0))
        val pushed: MutableList<Pair<ViewportSession, EnrichedFlight>> = mutableListOf()
        val consumer = LiveFlightConsumer(
            objectMapper = objectMapper,
            spatialPushEngine = SpatialPushEngine(
                viewportRegistry = registry,
                boundingBoxMatcher = BoundingBoxMatcher(),
                sessionFlightPusher = SessionFlightPusher { session, flight ->
                    pushed.add(session to flight)
                    true
                },
            ),
        )

        consumer.consume(ConsumerRecord("live-adsb", 0, 0L, "ICAO123", "{bad-json"))

        pushed shouldHaveSize 0
    }

    @Test
    public fun `should subscribe only live topic`() {
        val method = LiveFlightConsumer::class.java.getMethod("consume", ConsumerRecord::class.java)
        val annotation = method.getAnnotation(KafkaListener::class.java)

        annotation.topics.toList() shouldContain "\${tracking.kafka.topics.live:live-adsb}"
        annotation.topics.size shouldBe 1
    }

    private fun flight(lat: Double, lon: Double): EnrichedFlight =
        EnrichedFlight(
            icao = "ICAO123",
            lat = lat,
            lon = lon,
            eventTime = 1_700_000_000_000,
            sourceId = "radar-1",
            metadata = AircraftMetadata(),
        )
}
