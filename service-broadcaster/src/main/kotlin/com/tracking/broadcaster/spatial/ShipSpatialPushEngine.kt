package com.tracking.broadcaster.spatial

import com.tracking.broadcaster.viewport.TrackingMode
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.ws.SessionShipPusher
import com.tracking.common.dto.EnrichedShip
import org.springframework.stereotype.Component

@Component
public class ShipSpatialPushEngine(
    private val viewportRegistry: ViewportRegistry,
    private val sessionShipPusher: SessionShipPusher,
) {
    public fun pushToMatchingSessions(ship: EnrichedShip): Int {
        var pushedCount = 0
        val matchingSessions = viewportRegistry.sessionsContaining(ship.lat, ship.lon, TrackingMode.SHIP)
        matchingSessions.forEach { session ->
            if (session.viewport.contains(ship.lat, ship.lon) && sessionShipPusher.push(session, ship)) {
                pushedCount += 1
            }
        }
        return pushedCount
    }
}
