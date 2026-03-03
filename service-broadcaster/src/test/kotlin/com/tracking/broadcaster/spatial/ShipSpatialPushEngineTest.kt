package com.tracking.broadcaster.spatial

import com.tracking.broadcaster.viewport.TrackingMode
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.viewport.ViewportSession
import com.tracking.broadcaster.ws.SessionShipPusher
import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedShip
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class ShipSpatialPushEngineTest {
    @Test
    public fun `should push ship only to ship mode viewport`() {
        val registry = ViewportRegistry()
        val viewport = BoundingBox(north = 22.0, south = 20.0, east = 106.0, west = 105.0)
        registry.register("ship-session", "alice", viewport, TrackingMode.SHIP)
        registry.register("aircraft-session", "bob", viewport, TrackingMode.AIRCRAFT)
        val pushes: MutableList<Pair<ViewportSession, EnrichedShip>> = mutableListOf()
        val engine = ShipSpatialPushEngine(
            viewportRegistry = registry,
            sessionShipPusher = SessionShipPusher { session, ship ->
                pushes.add(session to ship)
                true
            },
        )

        val pushedCount = engine.pushToMatchingSessions(ship(lat = 21.0, lon = 105.5))

        pushedCount shouldBe 1
        pushes shouldHaveSize 1
        pushes.first().first.sessionId shouldBe "ship-session"
    }

    private fun ship(lat: Double, lon: Double): EnrichedShip =
        EnrichedShip(
            mmsi = "574001230",
            lat = lat,
            lon = lon,
            eventTime = 1_700_000_000_000,
            sourceId = "ais-1",
        )
}
