package com.tracking.processing.eventtime

import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class EventTimeResolverTest {
    private val resolver: EventTimeResolver = EventTimeResolver()

    @Test
    public fun `should mark older event as historical`() {
        val decision = resolver.resolve(previousEventTime = 2000L, candidateEventTime = 1000L)

        decision shouldBe EventTimeDecision.HISTORICAL
    }

    @Test
    public fun `should mark newer event as live`() {
        val decision = resolver.resolve(previousEventTime = 1000L, candidateEventTime = 2000L)

        decision shouldBe EventTimeDecision.LIVE
    }

    @Test
    public fun `should mark equal timestamp event as live`() {
        val decision = resolver.resolve(previousEventTime = 2000L, candidateEventTime = 2000L)

        decision shouldBe EventTimeDecision.LIVE
    }
}
