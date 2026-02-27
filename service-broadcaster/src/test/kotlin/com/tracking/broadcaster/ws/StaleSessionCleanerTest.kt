package com.tracking.broadcaster.ws

import com.tracking.broadcaster.metrics.BroadcasterMetrics
import com.tracking.broadcaster.viewport.ViewportRegistry
import com.tracking.common.dto.BoundingBox
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlin.test.Test

public class StaleSessionCleanerTest {
    @Test
    public fun `should keep active sessions and clean stale sessions`() {
        var now = 0L
        val viewportRegistry = ViewportRegistry(nowProvider = { now })
        val sessionRateLimiter = SessionRateLimiter(
            maxRequestsPerWindow = 10,
            windowMillis = 60_000,
            nowProvider = { now },
        )

        viewportRegistry.register("stale-session", "alice", BoundingBox(22.0, 20.0, 106.0, 105.0))
        sessionRateLimiter.allow("stale-session")

        now = 250_000
        viewportRegistry.register("active-session", "bob", BoundingBox(22.0, 20.0, 106.0, 105.0))
        sessionRateLimiter.allow("active-session")

        now = 400_000
        val meterRegistry = SimpleMeterRegistry()
        val metrics = BroadcasterMetrics(meterRegistry, viewportRegistry)
        val cleaner = StaleSessionCleaner(
            viewportRegistry = viewportRegistry,
            sessionRateLimiter = sessionRateLimiter,
            broadcasterMetrics = metrics,
            staleTimeoutMillis = 300_000,
        )

        cleaner.clean()

        viewportRegistry.isRegistered("stale-session").shouldBeFalse()
        viewportRegistry.isRegistered("active-session").shouldBeTrue()
        sessionRateLimiter.trackedSessions() shouldBe 1
        meterRegistry.counter("ws.sessions.cleaned").count() shouldBe 1.0
    }
}
