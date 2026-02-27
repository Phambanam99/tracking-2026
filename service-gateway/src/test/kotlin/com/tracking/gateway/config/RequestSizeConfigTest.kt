package com.tracking.gateway.config

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

public class RequestSizeConfigTest {
    private val properties = RequestSizeProperties(
        defaultMaxBytes = 1024,
        perPath = mapOf("/api/v1/ingest/**" to 256),
    )
    private val filter = RequestSizeConfig(properties, ObjectMapper())

    @Test
    public fun `should reject request larger than per-path policy`() {
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/events")
                .header("Content-Length", "300")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertFalse(chain.invoked)
        assertEquals(413, exchange.response.statusCode?.value())
    }

    @Test
    public fun `should allow request under configured limit`() {
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/events")
                .header("Content-Length", "200")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertTrue(chain.invoked)
    }

    private class CapturingChain : GatewayFilterChain {
        public var invoked: Boolean = false

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            invoked = true
            return Mono.empty()
        }
    }
}
