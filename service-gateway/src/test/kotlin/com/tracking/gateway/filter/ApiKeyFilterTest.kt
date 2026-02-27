package com.tracking.gateway.filter

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.gateway.config.GatewayRoutesConfig
import com.tracking.gateway.security.ApiKeyPrincipal
import com.tracking.gateway.security.ApiKeyVerifier
import com.tracking.gateway.security.BlacklistService
import com.tracking.gateway.security.GatewaySecurityProperties
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

public class ApiKeyFilterTest {
    @Test
    public fun `should extract non-empty api key`() {
        val filter = buildFilter(verifier = FixedApiKeyVerifier(ApiKeyPrincipal(sourceId = "SRC-1")))

        assertEquals("key-123", filter.extractApiKey(" key-123 "))
    }

    @Test
    public fun `should return null for empty api key`() {
        val filter = buildFilter(verifier = FixedApiKeyVerifier(ApiKeyPrincipal(sourceId = "SRC-1")))

        assertEquals(null, filter.extractApiKey("   "))
        assertEquals(null, filter.extractApiKey(null))
    }

    @Test
    public fun `should reject ingest route when api key missing`() {
        val filter = buildFilter(verifier = FixedApiKeyVerifier(ApiKeyPrincipal(sourceId = "SRC-1")))
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/api/v1/ingest/event").build())
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertFalse(chain.invoked)
        assertEquals(401, exchange.response.statusCode?.value())
    }

    @Test
    public fun `should attach source id when api key valid`() {
        val filter = buildFilter(verifier = FixedApiKeyVerifier(ApiKeyPrincipal(sourceId = "SRC-9")))
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/event")
                .header("x-api-key", "valid-key")
                .build(),
        )
        val chain = CapturingChain()

        filter.filter(exchange, chain).block()

        assertTrue(chain.invoked)
        assertEquals("SRC-9", chain.capturedExchange?.request?.headers?.getFirst("X-Source-Id"))
    }

    private fun buildFilter(verifier: ApiKeyVerifier): ApiKeyFilter {
        return ApiKeyFilter(
            routesConfig = GatewayRoutesConfig(),
            apiKeyVerificationService = verifier,
            blacklistService = BlacklistService(GatewaySecurityProperties()),
            objectMapper = ObjectMapper(),
        )
    }

    private class FixedApiKeyVerifier(
        private val principal: ApiKeyPrincipal?,
    ) : ApiKeyVerifier {
        override fun verify(apiKey: String): Mono<ApiKeyPrincipal> {
            return if (principal == null) Mono.empty() else Mono.just(principal)
        }
    }

    private class CapturingChain : GatewayFilterChain {
        public var invoked: Boolean = false
        public var capturedExchange: ServerWebExchange? = null

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            invoked = true
            capturedExchange = exchange
            return Mono.empty()
        }
    }
}
