package com.tracking.ingestion.security

import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.metrics.IngestionMetrics
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.Mockito.mock
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.WebFilterChain
import reactor.core.publisher.Mono
import reactor.test.StepVerifier

public class ApiKeyAuthWebFilterTest {
    @Test
    public fun `should reject ingest request when api key is missing`() {
        val ingestionProperties = ingestionProperties()
        val cacheService = ApiKeyCacheService(ingestionProperties)
        val authClient = mock(AuthServiceClient::class.java)
        val metrics = IngestionMetrics(SimpleMeterRegistry())
        val filter = ApiKeyAuthWebFilter(
            ingestionProperties,
            cacheService,
            authClient,
            metrics,
            com.fasterxml.jackson.databind.ObjectMapper(),
        )
        val chain = CapturingChain()
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/api/v1/ingest/adsb").build())

        StepVerifier.create(filter.filter(exchange, chain))
            .verifyComplete()

        assertEquals(401, exchange.response.statusCode?.value())
        assertTrue(chain.invoked.not())
        verifyNoInteractions(authClient)
    }

    @Test
    public fun `should allow request when api key found in local cache`() {
        val ingestionProperties = ingestionProperties()
        val cacheService = ApiKeyCacheService(ingestionProperties)
        val authClient = mock(AuthServiceClient::class.java)
        val metrics = IngestionMetrics(SimpleMeterRegistry())
        val filter = ApiKeyAuthWebFilter(
            ingestionProperties,
            cacheService,
            authClient,
            metrics,
            com.fasterxml.jackson.databind.ObjectMapper(),
        )
        val chain = CapturingChain()
        cacheService.cache("cached-key", ApiKeyPrincipal(sourceId = "SRC-CACHED"))
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/adsb")
                .header("x-api-key", "cached-key")
                .build(),
        )

        StepVerifier.create(filter.filter(exchange, chain))
            .verifyComplete()

        assertTrue(chain.invoked)
        assertEquals("SRC-CACHED", chain.exchange?.request?.headers?.getFirst("X-Source-Id"))
    }

    @Test
    public fun `should verify with auth service when cache miss and cache result`() {
        val ingestionProperties = ingestionProperties()
        val cacheService = ApiKeyCacheService(ingestionProperties)
        val authClient = mock(AuthServiceClient::class.java)
        given(authClient.verifyApiKey("new-key")).willReturn(Mono.just(ApiKeyPrincipal(sourceId = "SRC-NEW")))
        val metrics = IngestionMetrics(SimpleMeterRegistry())
        val filter = ApiKeyAuthWebFilter(
            ingestionProperties,
            cacheService,
            authClient,
            metrics,
            com.fasterxml.jackson.databind.ObjectMapper(),
        )
        val chain = CapturingChain()
        val exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/ingest/adsb")
                .header("x-api-key", "new-key")
                .build(),
        )

        StepVerifier.create(filter.filter(exchange, chain))
            .verifyComplete()

        assertTrue(chain.invoked)
        assertNotNull(cacheService.getIfPresent("new-key"))
        assertEquals("SRC-NEW", chain.exchange?.request?.headers?.getFirst("X-Source-Id"))
    }

    private fun ingestionProperties(): IngestionProperties {
        val properties = IngestionProperties()
        properties.ingestPath = "/api/v1/ingest/**"
        properties.security.enforceApiKey = true
        properties.security.apiKeyHeader = "x-api-key"
        properties.security.sourceIdHeader = "X-Source-Id"
        return properties
    }

    private class CapturingChain : WebFilterChain {
        var invoked: Boolean = false
        var exchange: ServerWebExchange? = null

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            invoked = true
            this.exchange = exchange
            return Mono.empty()
        }
    }
}
