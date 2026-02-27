package com.tracking.broadcaster.spatial

import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.broadcaster.ws.SessionFlightPusher
import com.tracking.common.dto.EnrichedFlight
import org.springframework.stereotype.Component

@Component
public class SpatialPushEngine(
    private val viewportRegistry: ViewportRegistry,
    private val boundingBoxMatcher: BoundingBoxMatcher,
    private val sessionFlightPusher: SessionFlightPusher,
) {
    public fun pushToMatchingSessions(flight: EnrichedFlight): Int {
        var pushedCount = 0
        val matchingSessions = viewportRegistry.sessionsContaining(flight.lat, flight.lon)
        matchingSessions.forEach { session ->
            if (boundingBoxMatcher.contains(session.viewport, flight) && sessionFlightPusher.push(session, flight)) {
                pushedCount += 1
            }
        }
        return pushedCount
    }
}
