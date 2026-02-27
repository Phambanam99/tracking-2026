package com.tracking.broadcaster.spatial

import com.tracking.common.dto.AircraftMetadata
import com.tracking.common.dto.BoundingBox
import com.tracking.common.dto.EnrichedFlight
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class SpatialPushEngineTest {
    private val matcher: BoundingBoxMatcher = BoundingBoxMatcher()

    @Test
    public fun `should include flight inside viewport`() {
        val viewport = BoundingBox(north = 22.0, south = 20.0, east = 106.0, west = 105.0)
        val flight =
            EnrichedFlight(
                icao = "ICAO123",
                lat = 21.0,
                lon = 105.5,
                eventTime = 1,
                sourceId = "source",
                metadata = AircraftMetadata(),
            )

        matcher.contains(viewport, flight) shouldBe true
    }
}
