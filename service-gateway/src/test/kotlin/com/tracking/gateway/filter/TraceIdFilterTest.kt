package com.tracking.gateway.filter

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

public class TraceIdFilterTest {
    @Test
    public fun `should generate request id and traceparent when missing`() {
        val filter = TraceIdFilter()
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/auth/login").build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        val requestId = chain.capturedExchange?.request?.headers?.getFirst("x-request-id")
        val traceparent = chain.capturedExchange?.request?.headers?.getFirst("traceparent")
        assertNotNull(requestId)
        assertNotNull(traceparent)
        assertTrue(traceparent!!.matches(Regex("^00-[0-9a-f]{32}-[0-9a-f]{16}-01$")))
        assertEquals(requestId, exchange.response.headers.getFirst("x-request-id"))
    }

    @Test
    public fun `should keep incoming trace headers`() {
        val filter = TraceIdFilter()
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/auth/login")
                .header("x-request-id", "req-001")
                .header("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertEquals("req-001", chain.capturedExchange?.request?.headers?.getFirst("x-request-id"))
        assertEquals(
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            chain.capturedExchange?.request?.headers?.getFirst("traceparent"),
        )
    }

    private class CapturingChain : GatewayFilterChain {
        public var capturedExchange: ServerWebExchange? = null

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            capturedExchange = exchange
            return Mono.empty()
        }
    }
}
