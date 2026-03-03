package com.tracking.broadcaster.kafka

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.tracking.broadcaster.spatial.ShipSpatialPushEngine
import com.tracking.broadcaster.viewport.TrackingMode
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.broadcaster.ws.SessionShipPusher
import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedShip
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlin.test.Test
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener

public class LiveShipConsumerTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    public fun `should push matching ship for valid payload`() {
        val registry = ViewportRegistry()
        registry.register("ship-session", "alice", BoundingBox(22.0, 20.0, 106.0, 105.0), TrackingMode.SHIP)
        val pushed: MutableList<Pair<ViewportSession, EnrichedShip>> = mutableListOf()
        val consumer = LiveShipConsumer(
            objectMapper = objectMapper,
            spatialPushEngine = ShipSpatialPushEngine(
                viewportRegistry = registry,
                sessionShipPusher = SessionShipPusher { session, ship ->
                    pushed.add(session to ship)
                    true
                },
            ),
        )
        val payload = objectMapper.writeValueAsString(ship(lat = 21.0, lon = 105.5))

        consumer.consume(ConsumerRecord("live-ais", 0, 0L, "574001230", payload))

        pushed shouldHaveSize 1
        pushed.first().first.sessionId shouldBe "ship-session"
    }

    @Test
    public fun `should subscribe only live ship topic`() {
        val method = LiveShipConsumer::class.java.getMethod("consume", ConsumerRecord::class.java)
        val annotation = method.getAnnotation(KafkaListener::class.java)

        annotation.topics.toList() shouldContain "\${tracking.kafka.topics.liveAis:live-ais}"
        annotation.topics.size shouldBe 1
    }

    private fun ship(lat: Double, lon: Double): EnrichedShip =
        EnrichedShip(
            mmsi = "574001230",
            lat = lat,
            lon = lon,
            eventTime = 1_700_000_000_000,
            sourceId = "ais-1",
            isHistorical = false,
        )
}
