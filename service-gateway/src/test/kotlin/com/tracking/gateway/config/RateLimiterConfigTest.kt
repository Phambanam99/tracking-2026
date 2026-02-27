package com.tracking.gateway.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange

public class RateLimiterConfigTest {
    @Test
    public fun `should return login rate limit policy from properties`() {
        val properties = RateLimiterProperties(
            policies = listOf(
                RateLimitPolicy(
                    routeId = "auth-login-route",
                    keyResolver = "ip",
                    replenishRatePerSecond = 5,
                    burstCapacity = 10,
                ),
            ),
        )

        val policy = RateLimiterConfig().loginPolicy(properties)

        assertEquals(5, policy.replenishRatePerSecond)
        assertEquals(10, policy.burstCapacity)
        assertEquals("auth-login-route", policy.routeId)
    }

    @Test
    public fun `should resolve api key from request header`() {
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/events")
                .header("x-api-key", " source-key ")
                .build(),
        )

        val resolved = RateLimiterConfig().apiKeyKeyResolver().resolve(exchange).block()

        assertEquals("source-key", resolved)
    }
}
