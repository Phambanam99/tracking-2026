package com.tracking.broadcaster.spatial

import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedFlight
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.broadcaster.ws.SessionFlightPusher
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class SpatialPushEngineTest {
    @Test
    public fun `should push flight inside matching viewport`() {
        val registry = ViewportRegistry()
        registry.register(
            sessionId = "session-1",
            principalName = "alice",
            viewport = BoundingBox(north = 22.0, south = 20.0, east = 106.0, west = 105.0),
        )
        val recorder = RecordingPusher()
        val engine = SpatialPushEngine(registry, BoundingBoxMatcher(), SessionFlightPusher { session, flight ->
            recorder.pushes.add(session to flight)
            true
        })
        val flight = flight(lat = 21.0, lon = 105.5)

        val pushedCount = engine.pushToMatchingSessions(flight)

        pushedCount shouldBe 1
        recorder.pushes shouldHaveSize 1
        recorder.pushes.first().first.sessionId shouldBe "session-1"
    }

    @Test
    public fun `should skip flight outside viewport`() {
        val registry = ViewportRegistry()
        registry.register(
            sessionId = "session-1",
            principalName = "alice",
            viewport = BoundingBox(north = 22.0, south = 20.0, east = 106.0, west = 105.0),
        )
        val recorder = RecordingPusher()
        val engine = SpatialPushEngine(registry, BoundingBoxMatcher(), SessionFlightPusher { session, flight ->
            recorder.pushes.add(session to flight)
            true
        })
        val flight = flight(lat = 30.0, lon = 110.0)

        val pushedCount = engine.pushToMatchingSessions(flight)

        pushedCount shouldBe 0
        recorder.pushes shouldHaveSize 0
    }

    @Test
    public fun `should return zero when no sessions registered`() {
        val engine = SpatialPushEngine(
            viewportRegistry = ViewportRegistry(),
            boundingBoxMatcher = BoundingBoxMatcher(),
            sessionFlightPusher = SessionFlightPusher { _, _ -> true },
        )

        val pushedCount = engine.pushToMatchingSessions(flight(lat = 21.0, lon = 105.5))

        pushedCount shouldBe 0
    }

    private fun flight(lat: Double, lon: Double): EnrichedFlight =
        EnrichedFlight(
            icao = "ICAO123",
            lat = lat,
            lon = lon,
            eventTime = 1,
            sourceId = "source",
            metadata = AircraftMetadata(),
        )

    private class RecordingPusher {
        val pushes: MutableList<Pair<ViewportSession, EnrichedFlight>> = mutableListOf()
    }
}
