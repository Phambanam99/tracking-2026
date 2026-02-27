package com.tracking.processing.routing

import com.tracking.processing.eventtime.EventTimeDecision
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class TopicRouterTest {
    @Test
    public fun `should use configured topics for routing`() {
        val router = TopicRouter(liveTopic = "live-adsb-v2", historicalTopic = "historical-adsb-v2")

        router.route(EventTimeDecision.LIVE) shouldBe "live-adsb-v2"
        router.route(EventTimeDecision.HISTORICAL) shouldBe "historical-adsb-v2"
    }
}
