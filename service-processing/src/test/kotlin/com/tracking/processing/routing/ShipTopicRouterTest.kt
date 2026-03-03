package com.tracking.processing.routing

import com.tracking.processing.eventtime.EventTimeDecision
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class ShipTopicRouterTest {
    @Test
    public fun `should use configured ship topics for routing`() {
        val router = ShipTopicRouter(liveTopic = "live-ais-v2", historicalTopic = "historical-ais-v2")

        router.route(EventTimeDecision.LIVE) shouldBe "live-ais-v2"
        router.route(EventTimeDecision.HISTORICAL) shouldBe "historical-ais-v2"
    }
}
