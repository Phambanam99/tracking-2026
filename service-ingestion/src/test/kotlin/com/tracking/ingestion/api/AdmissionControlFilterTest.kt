package com.tracking.ingestion.api

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.metrics.IngestionMetrics
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import java.util.concurrent.Semaphore
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.server.WebFilterChain
import reactor.core.publisher.Mono
import reactor.test.StepVerifier

public class AdmissionControlFilterTest {
    @Test
    public fun `should return 429 when admission permits exhausted`() {
        val properties = IngestionProperties()
        properties.ingestPath = "/api/v1/ingest/**"
        val filter = AdmissionControlFilter(
            ingestionProperties = properties,
            semaphore = Semaphore(0),
            ingestionMetrics = IngestionMetrics(SimpleMeterRegistry()),
            objectMapper = ObjectMapper(),
        )
        val chain = CapturingChain()
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/api/v1/ingest/adsb").build())

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete()

        assertEquals(429, exchange.response.statusCode?.value())
        assertTrue(chain.invoked.not())
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
