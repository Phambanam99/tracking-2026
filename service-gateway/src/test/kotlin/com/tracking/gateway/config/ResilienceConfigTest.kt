package com.tracking.gateway.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.web.reactive.function.client.WebClient

public class ResilienceConfigTest {
    @Test
    public fun `should build auth web client with configured timeouts`() {
        val properties = GatewayResilienceProperties(
            connectTimeoutMillis = 500,
            responseTimeoutMillis = 1200,
            readTimeoutMillis = 1200,
            writeTimeoutMillis = 1200,
            jwksCallTimeoutMillis = 800,
            apiKeyCallTimeoutMillis = 250,
            jwksCircuitBreakerName = "auth-jwks",
            apiKeyCircuitBreakerName = "auth-api-key",
        )

        val webClient = ResilienceConfig().authWebClient(WebClient.builder(), properties)

        assertNotNull(webClient)
        assertEquals(800, properties.jwksCallTimeoutMillis)
        assertEquals(250, properties.apiKeyCallTimeoutMillis)
    }
}
