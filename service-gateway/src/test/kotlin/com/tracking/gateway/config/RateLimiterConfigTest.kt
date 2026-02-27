package com.tracking.gateway.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

public class RateLimiterConfigTest {
    @Test
    public fun `should return login rate limit policy`() {
        val policy = RateLimiterConfig().loginPolicy()

        assertEquals(5, policy.replenishRatePerSecond)
        assertEquals(10, policy.burstCapacity)
    }
}
