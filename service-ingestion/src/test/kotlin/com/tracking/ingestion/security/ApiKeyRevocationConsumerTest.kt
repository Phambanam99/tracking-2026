package com.tracking.ingestion.security

import com.fasterxml.jackson.databind.ObjectMapper
import com.tracking.ingestion.config.IngestionProperties
import com.tracking.ingestion.metrics.IngestionMetrics
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

public class ApiKeyRevocationConsumerTest {
    @Test
    public fun `should revoke source id from auth revocation event`() {
        val properties = IngestionProperties()
        val cacheService = ApiKeyCacheService(properties)
        cacheService.cache("key-1", ApiKeyPrincipal(sourceId = "SRC-1"))
        val consumer = ApiKeyRevocationConsumer(
            objectMapper = ObjectMapper(),
            apiKeyCacheService = cacheService,
            ingestionMetrics = IngestionMetrics(SimpleMeterRegistry()),
        )

        consumer.consume("""{"type":"API_KEY_REVOKED","sourceId":"SRC-1"}""")

        assertTrue(cacheService.isSourceRevoked("SRC-1"))
        assertNull(cacheService.getIfPresent("key-1"))
    }
}
