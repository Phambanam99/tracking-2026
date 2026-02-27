package com.tracking.gateway.config

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

public class SecurityHeadersFilterTest {
    @Test
    public fun `should add default security headers before response commit`() {
        val filter = SecurityHeadersFilter()
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/ws/live").build())
        val chain = CompletingChain()

        assertDoesNotThrow {
            filter.filter(exchange, chain).block()
        }

        assertEquals("nosniff", exchange.response.headers.getFirst("X-Content-Type-Options"))
        assertEquals("DENY", exchange.response.headers.getFirst("X-Frame-Options"))
    }

    @Test
    public fun `should add hsts for forwarded https requests`() {
        val filter = SecurityHeadersFilter()
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/auth/login")
                .header("X-Forwarded-Proto", "https")
                .build(),
        )
        val chain = CompletingChain()

        filter.filter(exchange, chain).block()

        assertEquals(
            "max-age=31536000; includeSubDomains",
            exchange.response.headers.getFirst("Strict-Transport-Security"),
        )
    }

    private class CompletingChain : GatewayFilterChain {
        override fun filter(exchange: ServerWebExchange): Mono<Void> = exchange.response.setComplete()
    }
}
