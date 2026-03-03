package com.tracking.broadcaster.viewport

import com.tracking.common.dto.BoundingBox
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class ShipViewportRegistryModeTest {
    @Test
    public fun `should filter sessions by tracking mode`() {
        val registry = ViewportRegistry()
        val viewport = BoundingBox(22.0, 20.0, 106.0, 105.0)
        registry.register("aircraft-session", "alice", viewport, TrackingMode.AIRCRAFT)
        registry.register("ship-session", "bob", viewport, TrackingMode.SHIP)

        registry.sessionsContaining(21.0, 105.5, TrackingMode.AIRCRAFT).map { it.sessionId } shouldBe listOf("aircraft-session")
        registry.sessionsContaining(21.0, 105.5, TrackingMode.SHIP).map { it.sessionId } shouldBe listOf("ship-session")
        registry.sessionsContaining(21.0, 105.5).shouldHaveSize(2)
    }
}
