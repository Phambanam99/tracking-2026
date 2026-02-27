package com.tracking.broadcaster.spatial

import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedFlight
import org.springframework.stereotype.Component

@Component
public class BoundingBoxMatcher {
    public fun contains(viewport: BoundingBox, flight: EnrichedFlight): Boolean {
        return viewport.contains(flight.lat, flight.lon)
    }
}
