package com.tracking.broadcaster.ws

import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import kotlin.test.Test

public class SessionRateLimiterTest {
    @Test
    public fun `should allow under limit and reject over limit`() {
        var now = 1_000L
        val limiter = SessionRateLimiter(
            maxRequestsPerWindow = 2,
            windowMillis = 60_000,
            nowProvider = { now },
        )

        limiter.allow("session-1").shouldBeTrue()
        limiter.allow("session-1").shouldBeTrue()
        limiter.allow("session-1").shouldBeFalse()
    }

    @Test
    public fun `should reset limit after window passes`() {
        var now = 1_000L
        val limiter = SessionRateLimiter(
            maxRequestsPerWindow = 1,
            windowMillis = 1_000,
            nowProvider = { now },
        )

        limiter.allow("session-1").shouldBeTrue()
        limiter.allow("session-1").shouldBeFalse()
        now += 1_001
        limiter.allow("session-1").shouldBeTrue()
    }

    @Test
    public fun `should clear session state explicitly`() {
        var now = 1_000L
        val limiter = SessionRateLimiter(
            maxRequestsPerWindow = 1,
            windowMillis = 60_000,
            nowProvider = { now },
        )

        limiter.allow("session-1").shouldBeTrue()
        limiter.allow("session-1").shouldBeFalse()
        limiter.clear("session-1")

        limiter.allow("session-1").shouldBeTrue()
        limiter.trackedSessions() shouldBe 1
    }
}
